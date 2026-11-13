import { DashboardSample, SampleMetric, VitalSignsData } from '../types/vital-signs';

// Conexión y procesamiento de signos vitales desde el backend NestJS
export const API_CONFIG = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_LOCAL_API_URL ||
    '',
  dashboardApiToken: process.env.EXPO_PUBLIC_DASHBOARD_API_TOKEN || '',

  // Conservados para los servicios de misiones que aún usan esta configuración.
  localUrls: process.env.EXPO_PUBLIC_LOCAL_API_URL
    ? [process.env.EXPO_PUBLIC_LOCAL_API_URL]
    : ([] as string[]),
  userId: process.env.EXPO_PUBLIC_USER_ID || '',

  timeoutMs: 5000,
};

const SAMPLE_METRICS: readonly SampleMetric[] = [
  'heart_rate',
  'stress',
  'spo2',
  'steps',
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

async function requestSamples(
  limit: number,
  metric?: SampleMetric
): Promise<DashboardSample[]> {
  if (!API_CONFIG.apiBaseUrl) {
    throw new Error('Configura EXPO_PUBLIC_API_BASE_URL para conectar con el backend.');
  }
  if (!API_CONFIG.dashboardApiToken) {
    throw new Error('Configura EXPO_PUBLIC_DASHBOARD_API_TOKEN para autorizar el backend.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('El límite de muestras debe estar entre 1 y 500.');
  }

  const baseUrl = new URL(API_CONFIG.apiBaseUrl);
  if (baseUrl.protocol !== 'https:' && !(__DEV__ && baseUrl.protocol === 'http:')) {
    throw new Error('El backend debe usar HTTPS fuera del modo de desarrollo.');
  }

  const url = new URL('/dashboard/samples', baseUrl);
  url.searchParams.set('limit', String(limit));
  if (metric) {
    url.searchParams.set('metric', metric);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer);
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
  let steps = 0;
  let latestDate: Date | null = null;

  const pulseHistory: DashboardSample[] = [];
  const spo2History: DashboardSample[] = [];
  const stressHistory: DashboardSample[] = [];

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
    lastMeasuredAt: formattedTime,
    isAvailable: heartRate !== null && heartRate > 0,
    pulseHistory,
    spo2History,
    stressHistory,
  };
}

/** Estado inicial cuando no se han cargado datos aún */
export function getInitialEmptyVitals(): VitalSignsData {
  return {
    heartRate: null,
    spo2: null,
    stress: null,
    steps: 0,
    lastMeasuredAt: undefined,
    isAvailable: false,
    pulseHistory: [],
    spo2History: [],
    stressHistory: [],
  };
}
