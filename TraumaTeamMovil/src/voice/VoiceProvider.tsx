import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { useDrawer } from '@/components/trauma/drawer-context';
import { useMission } from '@/components/trauma/mission-context';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import { interpretWithLlm, MAX_HISTORY_TURNS, type VoiceRequestContext, type VoiceTurn } from '@/services/voice-api';

import { answer as dialogAnswer, needsDialog, startDialog, type DialogState, type Question } from './dialog';
import { haptic } from './haptics';
import { describeScreen, isScreen } from './capabilities';
import { isLowConfidence, parseCommand, zoneNameFor, type ParseResult, type VoiceIntent } from './parser';
import {
  VoiceContext,
  type AlertsIntent,
  type BodyIntent,
  type HealthIntent,
  type MissionsIntent,
  type VitalsIntent,
  type VoiceFeedback,
  getBodyTab,
} from './voice-context';
import { WarpTransition, type WarpTrip } from './WarpTransition';

const LISTEN_TIMEOUT_MS = 12000;
/** Si TTS no avisa de que terminó, se abre el micrófono igualmente pasado este tiempo. */
const speechFallbackMs = (text: string) => Math.max(2500, text.length * 95);

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
  const pathname = usePathname();
  const { t, locale, speech } = useI18n();
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [mode, setMode] = useState<'command' | 'dictation' | 'answer' | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bodyIntent, setBodyIntent] = useState<BodyIntent | null>(null);
  const [healthIntent, setHealthIntent] = useState<HealthIntent | null>(null);
  const [vitalsIntent, setVitalsIntent] = useState<VitalsIntent | null>(null);
  const [alertsIntent, setAlertsIntent] = useState<AlertsIntent | null>(null);
  const [missionsIntent, setMissionsIntent] = useState<MissionsIntent | null>(null);
  const [trip, setTrip] = useState<WarpTrip | null>(null);
  const [voiceId, setVoiceId] = useState<string | undefined>(undefined);
  const [level] = useState(() => new Animated.Value(0));

  const modeRef = useRef<'command' | 'dictation' | 'answer' | null>(null);
  /** Diálogo de huecos en curso (S3-S6). */
  const dialogRef = useRef<DialogState | null>(null);
  /** Conversación de aclaración con el LLM (S8): turnos recientes. */
  const llmHistory = useRef<VoiceTurn[]>([]);
  const llmOpen = useRef(false);
  const speakToken = useRef(0);
  const speakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerError = useRef(false);
  const beginRef = useRef<(m: 'command' | 'dictation' | 'answer') => Promise<void>>(async () => {});
  const dictationCb = useRef<((t: string) => void) | null>(null);
  const finalText = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonce = useRef(0);
  const tripActions = useRef(new Map<number, () => void>());
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
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

  /** Dice el texto y llama a `then` cuando termina (onDone, o por tiempo si TTS no avisa). */
  const speakThen = useCallback(
    (text: string, then: () => void) => {
      speakToken.current += 1;
      const token = speakToken.current;
      if (speakTimer.current) clearTimeout(speakTimer.current);
      let fired = false;
      const fire = () => {
        if (fired || speakToken.current !== token) return;
        fired = true;
        if (speakTimer.current) clearTimeout(speakTimer.current);
        speakTimer.current = null;
        then();
      };
      speakTimer.current = setTimeout(fire, speechFallbackMs(text));
      try {
        Speech.stop();
        Speech.speak(text, { language: speech.lang, voice: voiceId, rate: 1.0, pitch: 1.0, onDone: fire, onError: fire });
      } catch {
        fire();
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

  const pushHealthIntent = useCallback((fields: HealthIntent['fields']) => {
    nonce.current += 1;
    setHealthIntent({ nonce: nonce.current, fields });
  }, []);
  const pushVitalsIntent = useCallback((metric: VitalsIntent['metric']) => {
    nonce.current += 1;
    setVitalsIntent({ nonce: nonce.current, metric });
  }, []);
  const pushMissionsIntent = useCallback((action: MissionsIntent['action']) => {
    nonce.current += 1;
    setMissionsIntent({ nonce: nonce.current, action });
  }, []);
  const pushAlertsIntent = useCallback(() => {
    nonce.current += 1;
    setAlertsIntent({ nonce: nonce.current });
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
          warpTo(t('route./missions'), () => {
            pushMissionsIntent('checkin');
            router.navigate('/missions');
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
        case 'register-observation': {
          const name = intent.muscleName ?? zoneNameFor(intent.muscleId);
          const { type: _type, muscleId, muscleName: _name, ...prefill } = intent;
          report({ kind: 'success', text: t('action.registerObservation', { name }) }, true);
          warpTo(name, () => {
            pushBodyIntent({ tab: 'body', muscleId, action: 'register', prefill });
            router.navigate('/explore');
          });
          return;
        }
        case 'zone-detail':
        case 'zone-photos': {
          const name = intent.muscleName ?? zoneNameFor(intent.muscleId);
          const action = intent.type === 'zone-detail' ? 'detail' : 'photos';
          report(
            { kind: 'success', text: t(action === 'detail' ? 'action.zoneDetail' : 'action.zonePhotos', { name }) },
            true
          );
          warpTo(name, () => {
            pushBodyIntent({ tab: 'body', muscleId: intent.muscleId, action });
            router.navigate('/explore');
          });
          return;
        }
        case 'fill-health-check': {
          const { type: _type, ...fields } = intent;
          report({ kind: 'success', text: t('action.healthFill') }, true);
          warpTo(t('tab.health'), () => {
            pushHealthIntent(fields);
            pushBodyIntent({ tab: 'health' });
            router.navigate('/explore');
          });
          return;
        }
        case 'vital-history': {
          const metric = t(`metric.${intent.metric}` as MessageKey);
          report({ kind: 'success', text: t('action.vitalHistory', { metric }) }, true);
          warpTo(t('route./'), () => {
            pushVitalsIntent(intent.metric);
            router.navigate('/');
          });
          return;
        }
        case 'dismiss-alert':
          if (m.activeToasterAlert) {
            m.dismissToaster();
            report({ kind: 'success', text: t('action.alertDismissed') }, true);
          } else {
            report({ kind: 'info', text: t('action.noAlertToDismiss') }, true);
          }
          return;
        case 'set-environment': {
          const env = t(`env.${intent.environment}` as MessageKey);
          m.setEnvironment(intent.environment);
          report({ kind: 'success', text: t('action.environment', { env }) }, true);
          return;
        }
        case 'open-mission-setup':
          report({ kind: 'success', text: t('action.missionSetup') }, true);
          m.openMissionSetup();
          setPanelOpen(false);
          return;
        case 'arrive-early':
          m.arriveEarly();
          report({ kind: 'success', text: t('action.arriveEarly') }, true);
          return;
        case 'complete-mission': {
          const mission = m.missions.find((x) => x.id === intent.missionId);
          if (!mission) {
            report({ kind: 'error', text: t('action.missionUnavailable') }, true);
            return;
          }
          if (mission.completed) {
            report({ kind: 'info', text: t('action.missionAlreadyDone', { title: mission.title }) }, true);
            return;
          }
          m.toggleMission(mission.id);
          report({ kind: 'success', text: t('action.missionDone', { title: mission.title }) }, true);
          return;
        }
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
          setPanelOpen(false);
          pushAlertsIntent();
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
        case 'describe-screen':
        case 'help': {
          const current = pathnameRef.current;
          const screen = (intent.type === 'describe-screen' ? intent.screen : undefined) ?? (isScreen(current) ? current : undefined);
          if (!screen) {
            report({ kind: 'info', text: t('action.help') }, true);
            return;
          }
          const d = describeScreen(screen, t);
          const text =
            intent.type === 'help'
              ? `${t('action.help')} ${t('describe.here', { screen: d.title, summary: d.summary })}`
              : d.summary;
          setPanelOpen(true);
          report({ kind: 'info', text, items: d.examples });
          say(`${text} ${t('describe.try')} ${d.examples.join('. ')}`);
          return;
        }
        case 'stop':
          report({ kind: 'info', text: t('action.cancelled') });
          return;
      }
    },
    [drawer, pushAlertsIntent, pushBodyIntent, pushHealthIntent, pushMissionsIntent, pushVitalsIntent, report, say, t, warpTo]
  );

  /** Termina el diálogo/aclaración: olvida el estado y la pregunta mostrada. */
  const endConversation = useCallback(() => {
    dialogRef.current = null;
    llmHistory.current = [];
    llmOpen.current = false;
    answerError.current = false;
    setQuestion(null);
  }, []);

  /** Dice la pregunta y, al terminar de hablar, abre el micrófono en modo respuesta. */
  const ask = useCallback(
    (q: Question) => {
      const hint = q.hintKey ? `${t(q.hintKey)} ` : '';
      const text = `${hint}${t(q.key, q.params)}`;
      setQuestion(text);
      setTranscript('');
      setFeedback(null);
      speakThen(text, () => {
        if (dialogRef.current || llmOpen.current) void beginRef.current('answer');
      });
    },
    [speakThen, t]
  );

  /** Ejecuta una intención; si le faltan datos abre un diálogo para completarlos. */
  const run = useCallback(
    (intent: VoiceIntent) => {
      if (needsDialog(intent)) {
        const start = startDialog(intent);
        if (start.state) {
          llmHistory.current = [];
          llmOpen.current = false;
          dialogRef.current = start.state;
          setPanelOpen(true);
          ask(start.question);
          return;
        }
      }
      endConversation();
      execute(intent);
    },
    [ask, endConversation, execute]
  );

  const handleAnswer = useCallback(
    (text: string) => {
      const state = dialogRef.current;
      if (!state) return;
      const res = dialogAnswer(state, text);
      if (res.cancelled) {
        endConversation();
        report({ kind: 'info', text: t('dialog.cancelled') }, true);
      } else if (res.failed) {
        endConversation();
        report({ kind: 'error', text: t('dialog.failed') }, true);
      } else if (res.done) {
        endConversation();
        execute(res.done);
      } else if (res.question) {
        dialogRef.current = res.state;
        ask(res.question);
      }
    },
    [ask, endConversation, execute, report, t]
  );

  const failureText = useCallback(
    (result: Extract<ParseResult, { ok: false }>) =>
      result.reason === 'ambiguous'
        ? t('parse.ambiguous', { zone: result.zone })
        : t(result.reason === 'empty' ? 'parse.empty' : 'parse.unknown'),
    [t]
  );

  /** Contexto de pantalla para el LLM (S5): solo pantallas válidas; la pestaña solo en '/explore'. */
  const llmContext = useCallback((): VoiceRequestContext | undefined => {
    const screen = pathnameRef.current;
    if (!isScreen(screen)) return undefined;
    return screen === '/explore' ? { screen, tab: getBodyTab() } : { screen };
  }, []);

  /**
   * Pregunta al LLM (con el historial de la aclaración en curso, S8).
   * `localFallback`: resultado local de baja confianza (S7); si el LLM no está
   * disponible, falla o solo pide aclaración, se ejecuta en vez de dejar al usuario atascado.
   */
  const askLlm = useCallback(
    (text: string, fallback: string, localFallback?: VoiceIntent) => {
      setThinking(true);
      report({ kind: 'info', text: t('voice.thinking') });
      const history = llmHistory.current;
      void interpretWithLlm(text, locale, history, llmContext()).then((llm) => {
        setThinking(false);
        if (llm.ok && llm.intent) {
          run(llm.intent);
        } else if (localFallback) {
          run(localFallback);
        } else if (llm.ok) {
          const message = llm.message ?? fallback;
          const turns: VoiceTurn[] = [...history, { role: 'user', content: text }, { role: 'assistant', content: message }];
          llmHistory.current = turns.slice(-MAX_HISTORY_TURNS);
          if (llm.message && turns.length < MAX_HISTORY_TURNS + 2) {
            // Aclaración: el LLM pregunta algo, se habla y se vuelve a escuchar.
            llmOpen.current = true;
            ask({ key: 'dialog.llmMessage', params: { message } });
          } else {
            endConversation();
            report({ kind: 'error', text: message }, true);
          }
        } else {
          endConversation();
          report({
            kind: 'error',
            text: `${t(LLM_KEYS[llm.reason])}${'status' in llm && llm.status ? ` (HTTP ${llm.status})` : ''}`,
          });
        }
      });
    },
    [ask, endConversation, llmContext, locale, report, run, t]
  );

  const runText = useCallback(
    (text: string) => {
      if (dialogRef.current) {
        handleAnswer(text);
        return;
      }
      if (llmOpen.current) {
        if (/^\s*(cancela|cancelar|cancel|olv[ií]dalo|d[eé]jalo|stop|basta)\b/i.test(text)) {
          endConversation();
          report({ kind: 'info', text: t('dialog.cancelled') }, true);
          return;
        }
        askLlm(text, t('parse.unknown'));
        return;
      }
      const result = parseCommand(text);
      if (result.ok) {
        // S7: coincidencia genérica → el LLM decide con contexto; si no responde, se ejecuta la local.
        if (isLowConfidence(result)) askLlm(text, t('parse.unknown'), result.intent);
        else run(result.intent);
        return;
      }
      if (result.reason === 'ambiguous' && result.pending) {
        run(result.pending);
        return;
      }
      if (result.reason !== 'unknown') {
        report({ kind: 'error', text: failureText(result) }, result.reason !== 'empty');
        return;
      }
      // El intérprete local no lo entendió: se consulta al LLM (DeepSeek vía backend).
      askLlm(text, failureText(result));
    },
    [askLlm, endConversation, failureText, handleAnswer, report, run, t]
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
    // Un fallo real del micrófono durante una respuesta termina la conversación.
    if (!silent && modeRef.current === 'answer') answerError.current = true;
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
    if (current === 'answer') {
      if (answerError.current) {
        endConversation();
        return;
      }
      // Silencio = respuesta vacía: el diálogo la trata como no entendida (repite o se rinde).
      if (dialogRef.current) handleAnswer(text);
      else if (llmOpen.current) {
        if (text) askLlm(text, t('parse.unknown'));
        else endConversation();
      }
      return;
    }
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
    async (next: 'command' | 'dictation' | 'answer') => {
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
      answerError.current = false;
      finalText.current = '';
      modeRef.current = next;
      setMode(next);
      setTranscript('');
      if (next !== 'answer') setQuestion(null);
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
  useEffect(() => {
    beginRef.current = begin;
  }, [begin]);

  const startCommand = useCallback(() => {
    endConversation();
    setPanelOpen(true);
    void begin('command');
  }, [begin, endConversation]);

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

  const consumeHealthIntent = useCallback(
    (n: number) => setHealthIntent((cur) => (cur && cur.nonce === n ? null : cur)),
    []
  );
  const consumeVitalsIntent = useCallback(
    (n: number) => setVitalsIntent((cur) => (cur && cur.nonce === n ? null : cur)),
    []
  );
  const consumeAlertsIntent = useCallback(
    (n: number) => setAlertsIntent((cur) => (cur && cur.nonce === n ? null : cur)),
    []
  );

  const openPanel = useCallback(() => setPanelOpen(true), []);
  /** Cancela diálogo/aclaración: calla la voz, cierra el micrófono y olvida la conversación. */
  const cancelDialog = useCallback(() => {
    speakToken.current += 1;
    endConversation();
    try {
      Speech.stop();
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // nada que cancelar
    }
    clearTimer();
    modeRef.current = null;
    setMode(null);
    setListening(false);
    level.setValue(0);
  }, [endConversation, level]);

  const closePanel = useCallback(() => {
    cancelDialog();
    setPanelOpen(false);
  }, [cancelDialog]);

  const announce = useCallback((text: string) => report({ kind: 'success', text }, true), [report]);
  const consumeMissionsIntent = useCallback(
    (n: number) => setMissionsIntent((cur) => (cur && cur.nonce === n ? null : cur)),
    []
  );

  const value = useMemo(
    () => ({
      supported,
      listening,
      thinking,
      level,
      mode,
      question,
      transcript,
      feedback,
      panelOpen,
      openPanel,
      closePanel,
      startCommand,
      startDictation,
      stop,
      cancelDialog,
      announce,
      runText,
      bodyIntent,
      consumeBodyIntent,
      healthIntent,
      consumeHealthIntent,
      vitalsIntent,
      consumeVitalsIntent,
      alertsIntent,
      consumeAlertsIntent,
      missionsIntent,
      consumeMissionsIntent,
    }),
    [supported, listening, thinking, level, mode, transcript, feedback, panelOpen, openPanel, closePanel, startCommand, startDictation, stop, runText, bodyIntent, consumeBodyIntent, healthIntent, consumeHealthIntent, vitalsIntent, consumeVitalsIntent, alertsIntent, consumeAlertsIntent, question, cancelDialog, announce, missionsIntent, consumeMissionsIntent]
  );

  return (
    <VoiceContext.Provider value={value}>
      {children}
      <WarpTransition trip={trip} onPeak={onWarpPeak} onDone={onWarpDone} />
    </VoiceContext.Provider>
  );
}
