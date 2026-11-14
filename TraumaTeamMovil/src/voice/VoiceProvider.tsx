import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { useDrawer } from '@/components/trauma/drawer-context';
import { useMission } from '@/components/trauma/mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import { interpretWithLlm } from '@/services/voice-api';

import { haptic } from './haptics';
import { parseCommand, type ParseResult, type VoiceIntent } from './parser';
import { VoiceContext, type BodyIntent, type VoiceFeedback } from './voice-context';
import { WarpTransition, type WarpTrip } from './WarpTransition';

const LISTEN_TIMEOUT_MS = 12000;

const ERROR_KEYS: Record<string, MessageKey> = {
  'not-allowed': 'error.notAllowed',
  'service-not-allowed': 'error.serviceNotAllowed',
  network: 'error.network',
  'audio-capture': 'error.audioCapture',
  'language-not-supported': 'error.language',
};

const LLM_KEYS: Record<'not-configured' | 'unreachable' | 'disabled' | 'failed', MessageKey> = {
  'not-configured': 'llm.notConfigured',
  unreachable: 'llm.unreachable',
  disabled: 'llm.disabled',
  failed: 'llm.failed',
};

/**
 * Motor de voz: STT (nativo en iOS/Android, Web Speech API en web) →
 * intérprete local / LLM → acciones reales sobre la app, con transición espacial.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const drawer = useDrawer();
  const mission = useMission();
  const { t, locale, speech } = useI18n();
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<'command' | 'dictation' | null>(null);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bodyIntent, setBodyIntent] = useState<BodyIntent | null>(null);
  const [trip, setTrip] = useState<WarpTrip | null>(null);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [level] = useState(() => new Animated.Value(0));

  const modeRef = useRef<'command' | 'dictation' | null>(null);
  const dictationCb = useRef<((t: string) => void) | null>(null);
  const finalText = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonce = useRef(0);
  const tripActions = useRef(new Map<number, () => void>());
  const missionRef = useRef(mission);
  useEffect(() => {
    missionRef.current = mission;
  }, [mission]);

  const supported = useMemo(() => {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }, []);

  // Elige una voz nativa del idioma activo (mejor calidad primero), para que no
  // hable con la voz por defecto del sistema en otro idioma.
  useEffect(() => {
    let alive = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (!alive) return;
        const own = voices.filter((v) => v.language?.toLowerCase().startsWith(speech.voicePrefix));
        const exact = own.filter((v) => v.language?.toLowerCase() === speech.lang.toLowerCase());
        const pool = exact.length ? exact : own;
        const best = pool.find((v) => String(v.quality).toLowerCase() === 'enhanced') ?? pool[0];
        setVoiceId(best?.identifier);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [speech]);

  const say = useCallback(
    (text: string) => {
      try {
        Speech.stop();
        Speech.speak(text, { language: speech.lang, voice: voiceId, rate: 1.0, pitch: 1.0 });
      } catch {
        // La confirmación hablada es opcional: el feedback visual siempre se muestra.
      }
    },
    [speech.lang, voiceId]
  );

  const report = useCallback(
    (fb: VoiceFeedback, speak = false) => {
      setFeedback(fb);
      if (fb.kind === 'success') haptic.success();
      if (fb.kind === 'error') haptic.error();
      if (speak) say(fb.text);
    },
    [say]
  );

  /** Cierra el panel, lanza el salto espacial y navega en el pico de la animación. */
  const warpTo = useCallback(
    (label: string, action: () => void) => {
      nonce.current += 1;
      const id = nonce.current;
      tripActions.current.set(id, action);
      drawer.close();
      setPanelOpen(false);
      haptic.warp();
      setTrip({ id, label, heading: t('warp.heading') });
    },
    [drawer, t]
  );

  const onWarpPeak = useCallback((id: number) => {
    tripActions.current.get(id)?.();
    tripActions.current.delete(id);
  }, []);
  const onWarpDone = useCallback((id: number) => {
    setTrip((cur) => (cur?.id === id ? null : cur));
  }, []);

  const pushBodyIntent = useCallback((partial: Omit<BodyIntent, 'nonce'>) => {
    nonce.current += 1;
    setBodyIntent({ nonce: nonce.current, ...partial });
  }, []);

  const execute = useCallback(
    (intent: VoiceIntent) => {
      const m = missionRef.current;
      switch (intent.type) {
        case 'navigate': {
          const label = t(`route.${intent.route}` as MessageKey);
          report({ kind: 'success', text: t('action.opening', { label }) }, true);
          warpTo(label, () => router.navigate(intent.route));
          return;
        }
        case 'start-checkin':
          report({ kind: 'success', text: t('action.checkin') }, true);
          warpTo(t('tab.health'), () => {
            pushBodyIntent({ tab: 'health' });
            router.navigate('/explore');
          });
          return;
        case 'body-tab': {
          const label = t(`tab.${intent.tab}` as MessageKey);
          report({ kind: 'success', text: t('action.opening', { label }) }, true);
          warpTo(label, () => {
            pushBodyIntent({ tab: intent.tab });
            router.navigate('/explore');
          });
          return;
        }
        case 'body-zone':
          report({ kind: 'success', text: t('action.zone', { name: intent.muscleName }) }, true);
          warpTo(intent.muscleName, () => {
            pushBodyIntent({ tab: 'body', muscleId: intent.muscleId });
            router.navigate('/explore');
          });
          return;
        case 'open-menu':
          setPanelOpen(false);
          drawer.open();
          report({ kind: 'success', text: t('action.menuOpened') });
          return;
        case 'close-menu':
          drawer.close();
          report({ kind: 'success', text: t('action.menuClosed') });
          return;
        case 'open-alerts':
          report({ kind: 'info', text: t('action.alerts', { count: m.unreadAlertCount }) }, true);
          return;
        case 'ack-alerts':
          m.acknowledgeAllAlerts();
          report({ kind: 'success', text: t('action.alertsAck') }, true);
          return;
        case 'toggle-treadmill':
          m.toggleTreadmillRoutine();
          report({ kind: 'success', text: t('action.treadmill') }, true);
          return;
        case 'read-vitals': {
          const v = m.vitals;
          const parts = [
            v.heartRate !== null ? t('vitals.pulse', { value: v.heartRate }) : null,
            v.spo2 !== null ? t('vitals.spo2', { value: v.spo2 }) : null,
            v.stress !== null ? t('vitals.stress', { value: v.stress }) : null,
          ].filter(Boolean);
          report({ kind: 'info', text: parts.length ? parts.join(', ') : t('vitals.none') }, true);
          return;
        }
        case 'help':
          report({ kind: 'info', text: t('action.help') });
          return;
        case 'stop':
          report({ kind: 'info', text: t('action.cancelled') });
          return;
      }
    },
    [drawer, pushBodyIntent, report, t, warpTo]
  );

  const failureText = useCallback(
    (result: Extract<ParseResult, { ok: false }>) =>
      result.reason === 'ambiguous'
        ? t('parse.ambiguous', { zone: result.zone })
        : t(result.reason === 'empty' ? 'parse.empty' : 'parse.unknown'),
    [t]
  );

  const runText = useCallback(
    (text: string) => {
      const result = parseCommand(text);
      if (result.ok) {
        execute(result.intent);
        return;
      }
      if (result.reason !== 'unknown') {
        report({ kind: 'error', text: failureText(result) }, result.reason !== 'empty');
        return;
      }
      // El intérprete local no lo entendió: se consulta al LLM (DeepSeek vía backend).
      setThinking(true);
      report({ kind: 'info', text: t('voice.thinking') });
      void interpretWithLlm(text, locale).then((llm) => {
        setThinking(false);
        if (llm.ok && llm.intent) execute(llm.intent);
        else if (llm.ok) report({ kind: 'error', text: llm.message ?? failureText(result) }, true);
        else
          report({
            kind: 'error',
            text: `${t(LLM_KEYS[llm.reason])}${'status' in llm && llm.status ? ` (HTTP ${llm.status})` : ''}`,
          });
      });
    },
    [execute, failureText, locale, report, t]
  );

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    setTranscript(text);
    if (e.isFinal) finalText.current = text;
    // En web no hay evento de volumen: cada fragmento reconocido "late" la esfera.
    if (Platform.OS === 'web') {
      level.setValue(1);
      Animated.timing(level, { toValue: 0.15, duration: 450, useNativeDriver: true }).start();
    }
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    // value va de -2 a 10; < 0 es silencio.
    level.setValue(Math.max(0, Math.min(1, e.value / 10)));
  });

  useSpeechRecognitionEvent('error', (e) => {
    clearTimer();
    setListening(false);
    level.setValue(0);
    const silent = e.error === 'aborted' || e.error === 'no-speech';
    if (!silent) console.warn('[voice] recognition error', e.error, e.message);
    const key = ERROR_KEYS[e.error];
    report({
      kind: silent ? 'info' : 'error',
      text: silent ? t('error.silent') : key ? t(key) : t('error.generic', { code: e.error }),
    });
  });

  useSpeechRecognitionEvent('end', () => {
    clearTimer();
    setListening(false);
    level.setValue(0);
    const text = finalText.current.trim();
    finalText.current = '';
    const current = modeRef.current;
    modeRef.current = null;
    setMode(null);
    if (!text) return;
    if (current === 'dictation') {
      dictationCb.current?.(text);
      dictationCb.current = null;
      setPanelOpen(false);
      report({ kind: 'success', text: t('action.dictated') });
    } else if (current === 'command') {
      runText(text);
    }
  });

  const begin = useCallback(
    async (next: 'command' | 'dictation') => {
      if (!supported) {
        report({ kind: 'error', text: t('error.unsupported') });
        return;
      }
      // En web no hay API de permisos: el navegador pide el micrófono al iniciar.
      const perm =
        Platform.OS === 'web' ? { granted: true } : await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        report({ kind: 'error', text: t('error.notAllowed') });
        return;
      }
      Speech.stop();
      haptic.listen();
      finalText.current = '';
      modeRef.current = next;
      setMode(next);
      setTranscript('');
      setFeedback(null);
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: speech.lang,
        interimResults: true,
        continuous: false,
        addsPunctuation: next === 'dictation',
        volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
        contextualStrings: ['signos vitales', 'chequeo diario', 'bíceps', 'isquiotibiales', 'misiones'],
      });
      timer.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), LISTEN_TIMEOUT_MS);
    },
    [supported, report, t, speech.lang]
  );

  const startCommand = useCallback(() => {
    setPanelOpen(true);
    void begin('command');
  }, [begin]);

  const startDictation = useCallback(
    (onText: (text: string) => void) => {
      dictationCb.current = onText;
      setPanelOpen(true);
      void begin('dictation');
    },
    [begin]
  );

  const stop = useCallback(() => {
    clearTimer();
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(
    () => () => {
      clearTimer();
      try {
        ExpoSpeechRecognitionModule.abort();
        Speech.stop();
      } catch {
        // nada que limpiar
      }
    },
    []
  );

  const consumeBodyIntent = useCallback(
    (n: number) => setBodyIntent((cur) => (cur && cur.nonce === n ? null : cur)),
    []
  );

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => {
    stop();
    setPanelOpen(false);
  }, [stop]);

  const value = useMemo(
    () => ({
      supported,
      listening,
      thinking,
      level,
      mode,
      transcript,
      feedback,
      panelOpen,
      openPanel,
      closePanel,
      startCommand,
      startDictation,
      stop,
      runText,
      bodyIntent,
      consumeBodyIntent,
    }),
    [supported, listening, thinking, level, mode, transcript, feedback, panelOpen, openPanel, closePanel, startCommand, startDictation, stop, runText, bodyIntent, consumeBodyIntent]
  );

  return (
    <VoiceContext.Provider value={value}>
      {children}
      <WarpTransition trip={trip} onPeak={onWarpPeak} onDone={onWarpDone} />
    </VoiceContext.Provider>
  );
}
