import { createContext, useContext } from 'react';
import type { Animated } from 'react-native';

import type { BodyTab, HealthPrefill, ObservationPrefill, VitalMetric } from './parser';

export type VoiceFeedback = { kind: 'success' | 'error' | 'info'; text: string; /** Lista opcional (p. ej. ejemplos de comandos). */ items?: string[] };

// Pestaña visible de la vista corporal (la reporta BodyView; no es estado de React).
let bodyTab: BodyTab = 'body';
export const reportBodyTab = (tab: BodyTab) => {
  bodyTab = tab;
};
export const getBodyTab = (): BodyTab => bodyTab;

/** Intención pendiente para la pantalla corporal (se consume al montarse). */
export type BodyIntent = {
  nonce: number;
  tab?: BodyTab;
  muscleId?: string;
  /** Qué hacer con la zona: abrir el formulario de registro, el detalle o las fotos. */
  action?: 'register' | 'detail' | 'photos';
  /** Valores sugeridos para el formulario; el usuario revisa y guarda (S2). */
  prefill?: ObservationPrefill;
};
export type HealthIntent = { nonce: number; fields: HealthPrefill };
export type VitalsIntent = { nonce: number; metric: VitalMetric };
export type AlertsIntent = { nonce: number };
/** Acción pedida a la pantalla de misiones (check-in a través de la racha). */
export type MissionsIntent = { nonce: number; action: 'checkin' };

export type VoiceCtx = {
  /** El dispositivo/navegador puede reconocer voz. */
  supported: boolean;
  listening: boolean;
  /** Esperando la respuesta del LLM. */
  thinking: boolean;
  /** Nivel de voz 0..1 para animar la esfera. */
  level: Animated.Value;
  mode: 'command' | 'dictation' | 'answer' | null;
  /** Pregunta abierta (diálogo o aclaración del LLM) que se muestra sobre la esfera. */
  question: string | null;
  /** Texto parcial/final en vivo mientras se escucha. */
  transcript: string;
  feedback: VoiceFeedback | null;
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  startCommand: () => void;
  /** Dicta texto libre; el resultado se entrega a `onText` para que el usuario lo revise. */
  startDictation: (onText: (text: string) => void) => void;
  stop: () => void;
  /** Termina la conversación en curso (diálogo / aclaración del LLM) y la escucha. */
  cancelDialog: () => void;
  /** Muestra y dice un mensaje de éxito (p. ej. el resultado del check-in). */
  announce: (text: string) => void;
  /** Ejecuta texto como si se hubiera dicho (teclado de respaldo/pruebas). */
  runText: (text: string) => void;
  bodyIntent: BodyIntent | null;
  consumeBodyIntent: (nonce: number) => void;
  /** Campos del cuestionario diario dictados por voz (se rellenan, no se guardan). */
  healthIntent: HealthIntent | null;
  consumeHealthIntent: (nonce: number) => void;
  /** Abre el historial de una métrica en el monitor vital. */
  vitalsIntent: VitalsIntent | null;
  consumeVitalsIntent: (nonce: number) => void;
  /** Abre la campana de alertas. */
  alertsIntent: AlertsIntent | null;
  consumeAlertsIntent: (nonce: number) => void;
  /** Check-in diario pedido por voz: la pantalla de misiones lo ejecuta y resalta. */
  missionsIntent: MissionsIntent | null;
  consumeMissionsIntent: (nonce: number) => void;
};

export const VoiceContext = createContext<VoiceCtx | null>(null);

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice debe usarse dentro de <VoiceProvider>');
  return ctx;
}
