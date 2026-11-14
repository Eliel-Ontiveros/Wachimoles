import { DashboardSample, SampleMetric, VitalSignsData } from '../types/vital-signs';

// Conexión y procesamiento de signos vitales desde el backend NestJS
export const API_CONFIG = {
  apiBaseUrl: (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_LOCAL_API_URL ||
    ''
  ).trim(),
  dashboardApiToken: (
    process.env.EXPO_PUBLIC_DASHBOARD_API_TOKEN || ''
  ).trim(),

  // Conservados para los servicios de misiones que aún usan esta configuración.
  localUrls: process.env.EXPO_PUBLIC_LOCAL_API_URL
    ? [process.env.EXPO_PUBLIC_LOCAL_API_URL.trim()]
    : ([] as string[]),
  userId: (process.env.EXPO_PUBLIC_USER_ID || '').trim(),

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
    throw new Error('El backend devolvió una respuesta de muestras inválida.');
  }

  return value.map((sample: unknown) => {
    if (!isDashboardSample(sample)) {
      throw new Error('El backend devolvió una muestra con formato inválido.');
    }
    return sample;
  });
}

function getBackendCandidateBases(): string[] {
  const candidates: string[] = [];
  if (typeof window !== 'undefined' && window.location?.origin) {
    candidates.push(`${window.location.origin.replace(/\/+$/, '')}/__api_proxy`);
  }
  if (API_CONFIG.apiBaseUrl) {
    candidates.push(API_CONFIG.apiBaseUrl.replace(/\/+$/, ''));
  }
  for (const localUrl of API_CONFIG.localUrls) {
    if (localUrl) {
      candidates.push(localUrl.replace(/\/+$/, ''));
    }
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
  init: RequestInit = {}
): Promise<Response> {
  const normalizedPath = pathWithQuery.startsWith('/')
    ? pathWithQuery
    : `/${pathWithQuery}`;
  const candidates = getBackendCandidateBases();

  if (candidates.length === 0) {
    throw new Error('Configura EXPO_PUBLIC_API_BASE_URL para conectar con el backend.');
  }

  let lastError: unknown = null;

  for (const base of candidates) {
    const isProxy = base.endsWith('/__api_proxy');
    let targetUrl = `${base}${normalizedPath}`;

    if (!isProxy) {
      try {
        const parsedBase = new URL(base);
        if (
          parsedBase.protocol !== 'https:' &&
          !(__DEV__ && parsedBase.protocol === 'http:')
        ) {
          continue;
        }
        targetUrl = new URL(normalizedPath, parsedBase).toString();
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    const controller = new AbortController();
    const timeoutMs = isProxy ? Math.min(API_CONFIG.timeoutMs, 3000) : API_CONFIG.timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
        isProxy &&
        (response.status === 404 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504 ||
          contentType.includes('text/html'));

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
    : new Error('No se pudo conectar con el backend.');
}

async function requestSamples(
  limit: number,
  metric?: SampleMetric
): Promise<DashboardSample[]> {
  if (!API_CONFIG.apiBaseUrl && typeof window === 'undefined') {
    throw new Error('Configura EXPO_PUBLIC_API_BASE_URL para conectar con el backend.');
  }
  if (!API_CONFIG.dashboardApiToken) {
    throw new Error('Configura EXPO_PUBLIC_DASHBOARD_API_TOKEN para autorizar el backend.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('El límite de muestras debe estar entre 1 y 500.');
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
        throw new Error('El backend rechazó el token de acceso (401).');
      }
      throw new Error(`No se pudieron cargar las muestras (${response.status}).`);
    }

    return parseSamples(await response.json());
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La solicitud al backend agotó el tiempo de espera.');
    }
    throw error;
  }
}

/** Consulta las muestras del usuario fijo configurado y autorizado por el backend. */
export async function fetchDashboardSamples(limit = 100): Promise<DashboardSample[]> {
  return requestSamples(limit);
}

/** Consulta el historial de una métrica específica desde el backend NestJS. */
export async function fetchMetricHistory(
  metric: SampleMetric,
  limit = 300
): Promise<DashboardSample[]> {
  return requestSamples(limit, metric);
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

  for (const s of samples) {
    if (s.metric === 'heart_rate') {
      pulseHistory.push(s);
      if (heartRate === null) {
        heartRate = Math.round(s.value);
        const d = new Date(s.measuredAt);
        if (!latestDate || d > latestDate) latestDate = d;
      }
    }
    if (s.metric === 'spo2') {
      spo2History.push(s);
      if (spo2 === null) {
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
      if (sleepHours === null) {
        sleepHours = s.value;
      }
    }
    if (s.metric === 'steps' && steps === 0) {
      steps = Math.round(s.value);
    }
  }

  // Formato de tiempo de última medición
  let formattedTime: string | undefined = undefined;
  if (latestDate && !isNaN(latestDate.getTime())) {
    const diffSec = Math.floor((Date.now() - latestDate.getTime()) / 1000);
    if (diffSec < 60) {
      formattedTime = `Hace ${Math.max(1, diffSec)} seg`;
    } else if (diffSec < 3600) {
      formattedTime = `Hace ${Math.floor(diffSec / 60)} min`;
    } else {
      const h = String(latestDate.getHours()).padStart(2, '0');
      const m = String(latestDate.getMinutes()).padStart(2, '0');
      formattedTime = `A las ${h}:${m}`;
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
  };
}
