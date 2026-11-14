import type { Locale } from '../i18n/messages';
import type { VoiceIntent } from '../voice/parser';
import { API_CONFIG } from './vital-signs-api';

export type LlmInterpretation =
  | { ok: true; intent: VoiceIntent | null; message?: string }
  | { ok: false; reason: 'not-configured' | 'unreachable' | 'disabled' | 'failed'; status?: number };

const LLM_TIMEOUT_MS = 18000;

/**
 * Respaldo con LLM (DeepSeek vía backend) para frases que el intérprete local
 * no reconoce. Si no está disponible devuelve el motivo, para mostrarlo en la UI.
 */
export async function interpretWithLlm(text: string, locale: Locale): Promise<LlmInterpretation> {
  if (!API_CONFIG.apiBaseUrl || !API_CONFIG.dashboardApiToken) return { ok: false, reason: 'not-configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    const response = await fetch(new URL('/voice/interpret', API_CONFIG.apiBaseUrl).toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text.slice(0, 300), locale }),
      signal: controller.signal,
    });
    if (response.status === 503) return { ok: false, reason: 'disabled' };
    if (!response.ok) {
      console.warn('[voice] /voice/interpret failed', response.status);
      return { ok: false, reason: 'failed', status: response.status };
    }
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) return { ok: false, reason: 'failed' };
    const { intent, message } = data as { intent?: unknown; message?: unknown };
    return {
      ok: true,
      intent: typeof intent === 'object' && intent !== null ? (intent as VoiceIntent) : null,
      message: typeof message === 'string' ? message : undefined,
    };
  } catch (error) {
    console.warn('[voice] backend unreachable', error);
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
