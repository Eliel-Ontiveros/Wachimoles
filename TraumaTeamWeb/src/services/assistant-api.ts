import { ApiRequestError, getBackendConfig } from './backend-api.ts';

export type AssistantEnvironment = 'earth' | 'spacecraft' | 'moon' | 'mars';
export type AssistantMode = 'generated' | 'evidence_only' | 'insufficient_evidence' | 'generation_unavailable';

export interface AssistantCitation {
  citationId: number;
  title: string;
  publisher: string;
  url: string;
  retrievedAt: string;
  chunkId: string;
  wordOffset: number;
  excerpt: string;
}

export interface AssistantAnswer {
  mode: AssistantMode;
  answer: string;
  citations: AssistantCitation[];
  notice: string;
}

export interface AssistantQuestion {
  question: string;
  environment: AssistantEnvironment;
  bodyZone?: string;
  muscleReport?: {
    conditionName: string;
    painIntensity: number;
    swelling: boolean;
    functionalLimitation: boolean;
    notes: string;
    recordedAtIso?: string;
  };
}

const MODES: readonly string[] = ['generated', 'evidence_only', 'insufficient_evidence', 'generation_unavailable'];
const SOURCE_HOSTS = new Set([
  'www.nasa.gov', 'www.asc-csa.gc.ca', 'www.csa-asc.gc.ca',
  'pmc.ncbi.nlm.nih.gov', 'link.springer.com', 'www.frontiersin.org',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseAssistantAnswer(value: unknown): AssistantAnswer {
  if (!isRecord(value) || !MODES.includes(String(value.mode)) ||
    typeof value.answer !== 'string' || !value.answer.trim() ||
    typeof value.notice !== 'string' || !value.notice.trim() || !Array.isArray(value.citations)) {
    throw new Error('The backend returned an invalid assessment. Please try again.');
  }
  const ids = new Set<number>();
  for (const citation of value.citations) {
    if (!isRecord(citation) || !Number.isSafeInteger(citation.citationId) ||
      Number(citation.citationId) < 1 || ids.has(Number(citation.citationId)) ||
      typeof citation.title !== 'string' || typeof citation.publisher !== 'string' ||
      typeof citation.excerpt !== 'string' || !citation.excerpt.trim() ||
      typeof citation.url !== 'string' || typeof citation.retrievedAt !== 'string' ||
      !Number.isFinite(Date.parse(citation.retrievedAt)) ||
      typeof citation.chunkId !== 'string' || !Number.isSafeInteger(citation.wordOffset) ||
      Number(citation.wordOffset) < 0) {
      throw new Error('The backend returned an invalid source. No assessment was displayed.');
    }
    const url = new URL(citation.url);
    if (url.protocol !== 'https:' || !SOURCE_HOSTS.has(url.hostname) || url.username || url.password || url.port) {
      throw new Error('The backend returned a source outside the curated collection.');
    }
    ids.add(Number(citation.citationId));
  }
  if (value.mode === 'generated') {
    const paragraphs = value.answer.split(/\n\s*\n/).filter((text) => text.trim());
    if (!ids.size || paragraphs.some((text) => {
      const references = [...text.matchAll(/\[(\d+)\]/g)];
      return !references.length || references.some((match) => !ids.has(Number(match[1])));
    })) {
      throw new Error('The assessment contains missing or invalid references. Please try again.');
    }
  }
  return value as unknown as AssistantAnswer;
}

export async function askAssistant(body: AssistantQuestion, signal: AbortSignal): Promise<AssistantAnswer> {
  const config = getBackendConfig();
  if (!config.apiBaseUrl.trim() || !config.apiToken.trim()) {
    throw new Error('Configure VITE_API_BASE_URL and VITE_DASHBOARD_API_TOKEN in TraumaTeamWeb/.env, then restart the web app. The assistant requires a dashboard API token.');
  }
  const base = new URL(config.apiBaseUrl);
  if (base.protocol !== 'https:' && !(import.meta.env?.DEV && base.protocol === 'http:')) {
    throw new Error('The backend must use HTTPS outside development.');
  }
  // The provider can take 30 seconds. Do not reuse the dashboard's 6.5-second timeout.
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(40000)]);
  const response = await fetch(new URL('/dashboard/assistant/ask', base), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiToken.trim()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: requestSignal,
    cache: 'no-store',
  });
  if (!response.ok) {
    const message = response.status === 401
      ? 'The backend rejected the dashboard API token. Update VITE_DASHBOARD_API_TOKEN and restart the web app.'
      : response.status === 503
        ? 'The document index is unavailable. Rebuild and restart the backend with an indexed corpus.'
        : `The assessment request failed (${response.status}). Please try again.`;
    throw new ApiRequestError(response.status, message);
  }
  return parseAssistantAnswer(await response.json());
}
