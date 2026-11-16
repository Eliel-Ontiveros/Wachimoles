import Constants from 'expo-constants';
import { DashboardSample, SampleMetric, VitalSignsData } from '../types/vital-signs';

// Conexión y procesamiento de signos vitales desde el backend NestJS
export const API_CONFIG = {
  apiBaseUrl: (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_LOCAL_API_URL ||
    'https://wachimolesbackendult.vercel.app'
  ).trim(),
  dashboardApiToken: (
    process.env.EXPO_PUBLIC_DASHBOARD_API_TOKEN ||
    'G2oRRckFat8V7xAQRZEsT01JeHCuSUla-Y8fGv7ooaE'
  ).trim(),

  // Conservados para los servicios de misiones que aún usan esta configuración.
  localUrls: process.env.EXPO_PUBLIC_LOCAL_API_URL
    ? [process.env.EXPO_PUBLIC_LOCAL_API_URL.trim()]
    : ['https://wachimolesbackendult.vercel.app'],
  userId: (
    process.env.EXPO_PUBLIC_USER_ID ||
    '43235979-2b38-4a17-9a38-632484accad9'
  ).trim(),

  timeoutMs: 5000,
};

const SAMPLE_METRICS: readonly SampleMetric[] = [
  'heart_rate',
  'stress',
  'spo2',
  'steps',
  'sleep',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDashboardSample(value: unknown): value is DashboardSample {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    typeof value.sampleId === 'string' &&
    SAMPLE_METRICS.some((metric) => metric === value.metric) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    typeof value.unit === 'string' &&
    typeof value.measuredAt === 'string' &&
    typeof value.receivedAt === 'string'
  );
}

function parseSamples(value: unknown): DashboardSample[] {
  if (!Array.isArray(value)) {
    throw new Error('The backend returned an invalid samples response.');
  }

  return value.map((sample: unknown) => {
    if (!isDashboardSample(sample)) {
      throw new Error('The backend returned a sample with an invalid format.');
    }
    return sample;
  });
}

function isMetroDevBase(base: string): boolean {
  try {
    return new URL(base).port === '8081';
  } catch {
    return false;
  }
}

function getBackendCandidateBases(): string[] {
  const candidates: string[] = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    candidates.push(`${window.location.origin.replace(/\/+$/, '')}/__api_proxy`);
  }

  const pushConfiguredBase = (rawBase: string) => {
    const clean = rawBase.replace(/\/+$/, '');
    if (!clean) return;
    if (isMetroDevBase(clean)) {
      candidates.push(`${clean}/__api_proxy`);
    } else {
      candidates.push(clean);
    }
  };

  if (API_CONFIG.apiBaseUrl) {
    pushConfiguredBase(API_CONFIG.apiBaseUrl);
  }
  for (const localUrl of API_CONFIG.localUrls) {
    if (localUrl) {
      pushConfiguredBase(localUrl);
    }
  }

  if (typeof window === 'undefined' && __DEV__) {
    const rawHostUri = Constants.expoConfig?.hostUri;
    const expoHost =
      typeof rawHostUri === 'string' ? rawHostUri.split(':')[0]?.trim() : '';
    if (expoHost) {
      candidates.push(`http://${expoHost}:8081/__api_proxy`);
      candidates.push(`http://${expoHost}:3000`);
    }
    candidates.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  if (typeof window !== 'undefined') {
    const host = window.location?.hostname?.trim();
    if (host) {
      candidates.push(`http://${host}:3000`);
    }
    candidates.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  const unique: string[] = [];
  for (const entry of candidates) {
    if (entry && !unique.includes(entry)) {
      unique.push(entry);
    }
  }
  return unique;
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'TypeError' || error.name === 'AbortError';
}

export async function fetchBackendWithFallback(
  pathWithQuery: string,
  init: RequestInit = {},
  timeoutMs = API_CONFIG.timeoutMs
): Promise<Response> {
  const normalizedPath = pathWithQuery.startsWith('/')
    ? pathWithQuery
    : `/${pathWithQuery}`;
  const candidates = getBackendCandidateBases();

  if (candidates.length === 0) {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL to connect to the backend.');
  }

  let lastError: unknown = null;

  for (const base of candidates) {
    const isProxy = base.endsWith('/__api_proxy');
    let targetUrl = `${base}${normalizedPath}`;

    try {
      const parsedBase = new URL(base);
      if (
        parsedBase.protocol !== 'https:' &&
        !(__DEV__ && parsedBase.protocol === 'http:')
      ) {
        continue;
      }
      if (!isProxy) {
        targetUrl = new URL(normalizedPath, parsedBase).toString();
      }
    } catch (err) {
      lastError = err;
      continue;
    }

    const controller = new AbortController();
    const requestTimeoutMs = isProxy ? Math.min(timeoutMs, 3000) : timeoutMs;
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

    const externalSignal = init.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timer);
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await fetch(targetUrl, {
        ...init,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const isProxyUnavailable =
        contentType.includes('text/html') ||
        (isProxy &&
          (response.status === 404 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504));

      if (isProxyUnavailable) {
        lastError = new TypeError('Failed to fetch via proxy');
        continue;
      }

      return response;
    } catch (error: unknown) {
      lastError = error;
      if (externalSignal?.aborted) {
        throw error;
      }
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not connect to the backend.');
}

async function requestSamples(
  limit: number,
  metric?: SampleMetric
): Promise<DashboardSample[]> {
  if (!API_CONFIG.apiBaseUrl && typeof window === 'undefined') {
    throw new Error('Set EXPO_PUBLIC_API_BASE_URL to connect to the backend.');
  }
  if (!API_CONFIG.dashboardApiToken) {
    throw new Error('Set EXPO_PUBLIC_DASHBOARD_API_TOKEN to authorize the backend.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('The sample limit must be between 1 and 500.');
  }

  const query = metric
    ? `limit=${limit}&metric=${encodeURIComponent(metric)}`
    : `limit=${limit}`;
  const pathWithQuery = `/dashboard/samples?${query}`;

  try {
    const response = await fetchBackendWithFallback(pathWithQuery, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('The backend rejected the access token (401).');
      }
      throw new Error(`Could not load the samples (${response.status}).`);
    }

    return parseSamples(await response.json());
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The backend request timed out.');
    }
    throw error;
  }
}

/** Consulta las muestras del usuario fijo configurado y autorizado por el backend. */
export async function fetchDashboardSamples(limit = 500): Promise<DashboardSample[]> {
  return requestSamples(limit);
}

/** Consulta el historial de una métrica específica desde el backend NestJS. */
export async function fetchMetricHistory(
  metric: SampleMetric,
  limit = 300
): Promise<DashboardSample[]> {
  return requestSamples(limit, metric);
}

function hasHeadlineMetricSample(samples: DashboardSample[], metric: SampleMetric): boolean {
  return samples.some((s) => {
    if (s.metric !== metric) return false;
    return metric === 'stress' || metric === 'steps' ? s.value >= 0 : s.value > 0;
  });
}

function mergeAndSortSamples(groups: DashboardSample[][]): DashboardSample[] {
  const byKey = new Map<string, DashboardSample>();
  for (const group of groups) {
    for (const sample of group) {
      const key = `${sample.metric}:${sample.id}:${sample.sampleId}`;
      if (!byKey.has(key)) {
        byKey.set(key, sample);
      }
    }
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const tA = Date.parse(a.measuredAt);
    const tB = Date.parse(b.measuredAt);
    const diff = (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
    return diff !== 0 ? diff : b.id - a.id;
  });
}

/**
 * Obtiene las muestras generales y completa por métrica (por ejemplo `spo2` o `sleep`)
 * cuando lecturas frecuentes de pulso/estrés desplazan a las menos frecuentes fuera del lote inicial.
 */
export async function fetchLatestVitalsSamples(limit = 500): Promise<DashboardSample[]> {
  const baseSamples = await fetchDashboardSamples(limit);
  if (baseSamples.length === 0) {
    return [];
  }

  const missingMetrics = SAMPLE_METRICS.filter(
    (metric) => !hasHeadlineMetricSample(baseSamples, metric)
  );
  if (missingMetrics.length === 0) {
    return baseSamples;
  }

  const extraResults = await Promise.allSettled(
    missingMetrics.map((metric) => fetchMetricHistory(metric, 30))
  );
  const extraGroups = extraResults
    .filter((res): res is PromiseFulfilledResult<DashboardSample[]> => res.status === 'fulfilled')
    .map((res) => res.value);

  if (extraGroups.length === 0) {
    return baseSamples;
  }

  return mergeAndSortSamples([baseSamples, ...extraGroups]);
}

export async function fetchHeartRateHistory(limit = 300): Promise<DashboardSample[]> {
  return fetchMetricHistory('heart_rate', limit);
}

/**
 * Procesa la lista de muestras reales y extrae los datos del sensor.
 * Si no hay muestras de pulso, heartRate es null (no se inventa ningún número).
 */
export function extractLatestVitals(samples: DashboardSample[]): VitalSignsData {
  let heartRate: number | null = null;
  let spo2: number | null = null;
  let stress: number | null = null;
  let sleepHours: number | null = null;
  let steps = 0;
  let latestDate: Date | null = null;

  const pulseHistory: DashboardSample[] = [];
  const spo2History: DashboardSample[] = [];
  const stressHistory: DashboardSample[] = [];
  const sleepHistory: DashboardSample[] = [];
  const stepsHistory: DashboardSample[] = [];

  for (const s of samples) {
    if (s.metric === 'heart_rate') {
      pulseHistory.push(s);
      if (heartRate === null && s.value > 0) {
        heartRate = Math.round(s.value);
        const d = new Date(s.measuredAt);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }
    if (s.metric === 'spo2') {
      spo2History.push(s);
      if (spo2 === null && s.value > 0) {
        spo2 = Math.round(s.value);
        const d = new Date(s.measuredAt);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }
    if (s.metric === 'stress') {
      stressHistory.push(s);
      if (stress === null) {
        stress = Math.round(s.value);
        const d = new Date(s.measuredAt);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }
    if (s.metric === 'sleep') {
      sleepHistory.push(s);
      if (sleepHours === null && s.value > 0) {
        sleepHours = s.value;
      }
    }
    if (s.metric === 'steps') {
      stepsHistory.push(s);
      if (steps === 0) {
        steps = Math.round(s.value);
      }
    }
  }

  // Formato de tiempo de última medición
  let formattedTime: string | undefined = undefined;
  if (latestDate && !isNaN(latestDate.getTime())) {
    const diffSec = Math.floor((Date.now() - latestDate.getTime()) / 1000);
    if (diffSec < 60) {
      formattedTime = `${Math.max(1, diffSec)} sec ago`;
    } else if (diffSec < 3600) {
      formattedTime = `${Math.floor(diffSec / 60)} min ago`;
    } else {
      const h = String(latestDate.getHours()).padStart(2, '0');
      const m = String(latestDate.getMinutes()).padStart(2, '0');
      formattedTime = `At ${h}:${m}`;
    }
  }

  return {
    heartRate,
    spo2,
    stress,
    steps,
    sleepHours,
    lastMeasuredAt: formattedTime,
    isAvailable: heartRate !== null && heartRate > 0,
    pulseHistory,
    spo2History,
    stressHistory,
    sleepHistory,
    stepsHistory,
  };
}

/** Estado inicial cuando no se han cargado datos aún */
export function getInitialEmptyVitals(): VitalSignsData {
  return {
    heartRate: null,
    spo2: null,
    stress: null,
    steps: 0,
    sleepHours: null,
    lastMeasuredAt: undefined,
    isAvailable: false,
    pulseHistory: [],
    spo2History: [],
    stressHistory: [],
    sleepHistory: [],
    stepsHistory: [],
  };
}
