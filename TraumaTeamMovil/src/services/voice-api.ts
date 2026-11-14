import type { VoiceIntent } from '../voice/parser';
import { API_CONFIG } from './vital-signs-api';

export type LlmInterpretation = { intent: VoiceIntent | null; message?: string };

const LLM_TIMEOUT_MS = 9000;

/**
 * Respaldo con LLM (DeepSeek vía backend) para frases que el intérprete local
 * no reconoce. Devuelve null si el servicio no está disponible: la app sigue
 * funcionando con el intérprete local.
 */
export async function interpretWithLlm(text: string): Promise<LlmInterpretation | null> {
  if (!API_CONFIG.apiBaseUrl || !API_CONFIG.dashboardApiToken) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch(new URL('/voice/interpret', API_CONFIG.apiBaseUrl).toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.slice(0, 300) }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) return null;
    const { intent, message } = data as { intent?: unknown; message?: unknown };
    return {
      intent: typeof intent === 'object' && intent !== null ? (intent as VoiceIntent) : null,
      message: typeof message === 'string' ? message : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
