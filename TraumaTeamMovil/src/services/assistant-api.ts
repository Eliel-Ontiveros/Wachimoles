import { API_CONFIG } from './vital-signs-api';

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
export interface AssistantStatus {
  indexedSources: number;
  indexedPassages: number;
  generationConfigured: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function requestAssistant(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  if (!API_CONFIG.apiBaseUrl || !API_CONFIG.dashboardApiToken) {
    throw new Error('Configure the backend URL and dashboard token to use the assistant.');
  }
  const base = new URL(API_CONFIG.apiBaseUrl);
  if (base.protocol !== 'https:' && !(__DEV__ && base.protocol === 'http:')) {
    throw new Error('The backend must use HTTPS outside development.');
  }
  const response = await fetch(new URL(`/dashboard/assistant/${path}`, base).toString(), {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('The backend rejected the dashboard token.');
    if (response.status === 503) throw new Error('The resource index is not ready. Run rag:ingest and restart the backend.');
    throw new Error(`The assistant request failed (${response.status}). Please try again.`);
  }
  return response.json();
}

export async function fetchAssistantStatus(signal: AbortSignal): Promise<AssistantStatus> {
  const value = await requestAssistant('status', signal);
  if (!isRecord(value) || !Number.isInteger(value.indexedSources) || !Number.isInteger(value.indexedPassages) || typeof value.generationConfigured !== 'boolean') {
    throw new Error('The backend returned an invalid assistant status.');
  }
  return value as unknown as AssistantStatus;
}

export async function askAssistant(body: { question: string; environment: AssistantEnvironment; bodyZone?: string }, signal: AbortSignal): Promise<AssistantAnswer> {
  const value = await requestAssistant('ask', signal, body);
  const modes: AssistantMode[] = ['generated', 'evidence_only', 'insufficient_evidence', 'generation_unavailable'];
  if (!isRecord(value) || !modes.includes(value.mode as AssistantMode) || typeof value.answer !== 'string' || typeof value.notice !== 'string' || !Array.isArray(value.citations)) {
    throw new Error('The backend returned an invalid assistant answer.');
  }
  for (const citation of value.citations) {
    if (!isRecord(citation) || !Number.isInteger(citation.citationId) || typeof citation.title !== 'string' || typeof citation.publisher !== 'string' || typeof citation.excerpt !== 'string' || typeof citation.url !== 'string' || typeof citation.retrievedAt !== 'string' || typeof citation.chunkId !== 'string' || !Number.isInteger(citation.wordOffset)) {
      throw new Error('The backend returned an invalid source.');
    }
    const url = new URL(citation.url);
    if (url.protocol !== 'https:' || !['www.nasa.gov', 'www.asc-csa.gc.ca', 'www.csa-asc.gc.ca'].includes(url.hostname)) {
      throw new Error('The backend returned a source outside the curated agency collection.');
    }
  }
  return value as unknown as AssistantAnswer;
}
