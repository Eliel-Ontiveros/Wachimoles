import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { useDrawer } from '@/components/trauma/drawer-context';
import { useMission } from '@/components/trauma/mission-context';

import { interpretWithLlm } from '@/services/voice-api';

import { parseCommand, type VoiceIntent } from './parser';
import { VoiceContext, type BodyIntent, type VoiceFeedback } from './voice-context';

const LANG = 'es-ES';
const LISTEN_TIMEOUT_MS = 12000;

/**
 * Motor de voz: STT (nativo en iOS/Android, Web Speech API en web) →
 * intérprete de lenguaje natural → acciones reales sobre la app.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const drawer = useDrawer();
  const mission = useMission();
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState<'command' | 'dictation' | null>(null);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bodyIntent, setBodyIntent] = useState<BodyIntent | null>(null);

  const modeRef = useRef<'command' | 'dictation' | null>(null);
  const dictationCb = useRef<((t: string) => void) | null>(null);
  const finalText = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nonce = useRef(0);
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

  const say = useCallback((text: string) => {
    try {
      Speech.stop();
      Speech.speak(text, { language: LANG, rate: 1.05 });
    } catch {
      // La confirmación hablada es opcional: el feedback visual siempre se muestra.
    }
  }, []);

  const report = useCallback((fb: VoiceFeedback, speak = false) => {
    setFeedback(fb);
    if (speak) say(fb.text);
  }, [say]);

  const pushBodyIntent = useCallback((partial: Omit<BodyIntent, 'nonce'>) => {
    nonce.current += 1;
    setBodyIntent({ nonce: nonce.current, ...partial });
  }, []);

  const execute = useCallback(
    (intent: VoiceIntent) => {
      const m = missionRef.current;
      switch (intent.type) {
        case 'navigate':
          drawer.close();
          router.navigate(intent.route);
          report({ kind: 'success', text: `Abriendo ${intent.label}` }, true);
          return;
        case 'open-menu':
          drawer.open();
          report({ kind: 'success', text: 'Menú abierto' });
          return;
        case 'close-menu':
          drawer.close();
          report({ kind: 'success', text: 'Menú cerrado' });
          return;
        case 'open-alerts':
          router.navigate('/');
          report({ kind: 'info', text: `Tienes ${m.unreadAlertCount} alertas sin leer. Toca la campana para verlas.` }, true);
          return;
        case 'ack-alerts':
          m.acknowledgeAllAlerts();
          report({ kind: 'success', text: 'Alertas marcadas como leídas' }, true);
          return;
        case 'start-checkin':
          drawer.close();
          pushBodyIntent({ tab: 'health' });
          router.navigate('/explore');
          report({ kind: 'success', text: 'Iniciando chequeo diario' }, true);
          return;
        case 'body-tab':
          drawer.close();
          pushBodyIntent({ tab: intent.tab });
          router.navigate('/explore');
          report({ kind: 'success', text: `Abriendo ${intent.label}` }, true);
          return;
        case 'body-zone':
          drawer.close();
          pushBodyIntent({ tab: 'body', muscleId: intent.muscleId });
          router.navigate('/explore');
          report({ kind: 'success', text: `Zona: ${intent.muscleName}` }, true);
          return;
        case 'toggle-treadmill':
          m.toggleTreadmillRoutine();
          report({ kind: 'success', text: 'Rutina de cinta alternada' }, true);
          return;
        case 'read-vitals': {
          const v = m.vitals;
          const parts = [
            v.heartRate !== null ? `pulso ${v.heartRate} latidos por minuto` : null,
            v.spo2 !== null ? `oxígeno ${v.spo2} por ciento` : null,
            v.stress !== null ? `estrés ${v.stress}` : null,
          ].filter(Boolean);
          router.navigate('/');
          report(
            { kind: 'info', text: parts.length ? parts.join(', ') : 'Aún no hay datos del reloj.' },
            true
          );
          return;
        }
        case 'help':
          report({ kind: 'info', text: 'Prueba: "abre signos vitales", "iniciar chequeo diario", "ve al bíceps derecho".' });
          return;
        case 'stop':
          report({ kind: 'info', text: 'Cancelado' });
          return;
      }
    },
    [drawer, pushBodyIntent, report]
  );

  const runText = useCallback(
    (text: string) => {
      const result = parseCommand(text);
      if (result.ok) {
        execute(result.intent);
        return;
      }
      if (result.reason !== 'unknown') {
        report({ kind: 'error', text: result.hint }, result.reason !== 'empty');
        return;
      }
      // El intérprete local no lo entendió: se consulta al LLM (DeepSeek vía backend).
      report({ kind: 'info', text: 'Pensando…' });
      void interpretWithLlm(text).then((llm) => {
        if (llm.ok && llm.intent) {
          execute(llm.intent);
          return;
        }
        if (llm.ok) {
          report({ kind: 'error', text: llm.message ?? result.hint }, true);
          return;
        }
        const why: Record<typeof llm.reason, string> = {
          'not-configured': 'IA no configurada: falta EXPO_PUBLIC_API_BASE_URL / EXPO_PUBLIC_DASHBOARD_API_TOKEN en la app.',
          unreachable: 'IA no disponible: no se pudo contactar el backend (¿está corriendo? ¿CORS_ORIGINS incluye este origen?).',
          disabled: 'IA no disponible: el backend no tiene DEEPSEEK_API_KEY.',
          failed: 'La IA no pudo procesar la frase. Intenta de nuevo.',
        };
        report({ kind: 'error', text: `${why[llm.reason]} ${result.hint}` });
      });
    },
    [execute, report]
  );

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    setTranscript(text);
    if (e.isFinal) finalText.current = text;
  });

  useSpeechRecognitionEvent('error', (e) => {
    clearTimer();
    setListening(false);
    const silent = e.error === 'aborted' || e.error === 'no-speech';
    const known: Record<string, string> = {
      'not-allowed': 'Permiso de micrófono denegado. Actívalo en los ajustes del navegador o del teléfono.',
      'service-not-allowed':
        'El servicio de voz no está permitido. Usa Chrome/Edge/Safari (no un navegador embebido) y permite el micrófono.',
      network:
        'El reconocimiento de voz necesita conexión a internet (el navegador usa un servicio en la nube). Revisa tu red o prueba en Chrome.',
      'audio-capture': 'No se detectó ningún micrófono. Conéctalo o revisa los permisos.',
      'language-not-supported': 'Idioma de voz no disponible en este dispositivo.',
    };
    if (!silent) console.warn('[voice] recognition error', e.error, e.message);
    report({
      kind: silent ? 'info' : 'error',
      text: silent
        ? 'No te escuché. Toca el micrófono y vuelve a intentar.'
        : (known[e.error] ?? `Error de voz (${e.error})${e.message ? `: ${e.message}` : ''}`),
    });
  });

  useSpeechRecognitionEvent('end', () => {
    clearTimer();
    setListening(false);
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
      setFeedback({ kind: 'success', text: 'Texto dictado. Revísalo antes de guardar.' });
    } else if (current === 'command') {
      runText(text);
    }
  });

  const begin = useCallback(
    async (next: 'command' | 'dictation') => {
      if (!supported) {
        report({ kind: 'error', text: 'Este dispositivo o navegador no soporta reconocimiento de voz.' });
        return;
      }
      // En web no hay API de permisos: el navegador pide el micrófono al iniciar.
      const perm =
        Platform.OS === 'web' ? { granted: true } : await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        report({ kind: 'error', text: 'Permiso de micrófono denegado. Actívalo en los ajustes.' });
        return;
      }
      Speech.stop();
      finalText.current = '';
      modeRef.current = next;
      setMode(next);
      setTranscript('');
      setFeedback(null);
      setListening(true);
      ExpoSpeechRecognitionModule.start({
        lang: LANG,
        interimResults: true,
        continuous: false,
        addsPunctuation: next === 'dictation',
        contextualStrings: ['signos vitales', 'chequeo diario', 'bíceps', 'isquiotibiales', 'misiones'],
      });
      timer.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), LISTEN_TIMEOUT_MS);
    },
    [supported, report]
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

  useEffect(() => () => {
    clearTimer();
    try {
      ExpoSpeechRecognitionModule.abort();
      Speech.stop();
    } catch {
      // nada que limpiar
    }
  }, []);

  const consumeBodyIntent = useCallback(
    (n: number) => setBodyIntent((cur) => (cur && cur.nonce === n ? null : cur)),
    []
  );

  const value = useMemo(
    () => ({
      supported,
      listening,
      mode,
      transcript,
      feedback,
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => {
        stop();
        setPanelOpen(false);
      },
      startCommand,
      startDictation,
      stop,
      runText,
      bodyIntent,
      consumeBodyIntent,
    }),
    [supported, listening, mode, transcript, feedback, panelOpen, startCommand, startDictation, stop, runText, bodyIntent, consumeBodyIntent]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
