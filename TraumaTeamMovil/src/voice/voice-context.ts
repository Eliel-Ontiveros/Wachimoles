import { createContext, useContext } from 'react';
import type { Animated } from 'react-native';

import type { BodyTab } from './parser';

export type VoiceFeedback = { kind: 'success' | 'error' | 'info'; text: string };

/** Intención pendiente para la pantalla corporal (se consume al montarse). */
export type BodyIntent = { nonce: number; tab?: BodyTab; muscleId?: string };

export type VoiceCtx = {
  /** El dispositivo/navegador puede reconocer voz. */
  supported: boolean;
  listening: boolean;
  /** Esperando la respuesta del LLM. */
  thinking: boolean;
  /** Nivel de voz 0..1 para animar la esfera. */
  level: Animated.Value;
  mode: 'command' | 'dictation' | null;
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
  /** Ejecuta texto como si se hubiera dicho (teclado de respaldo/pruebas). */
  runText: (text: string) => void;
  bodyIntent: BodyIntent | null;
  consumeBodyIntent: (nonce: number) => void;
};

export const VoiceContext = createContext<VoiceCtx | null>(null);

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice debe usarse dentro de <VoiceProvider>');
  return ctx;
}
