import { DashboardSample, SampleMetric, VitalSignsData } from '../types/vital-signs';

// Conexión y procesamiento de signos vitales desde NestJS y Supabase
export const API_CONFIG = {
  localUrls: process.env.EXPO_PUBLIC_LOCAL_API_URL
    ? [process.env.EXPO_PUBLIC_LOCAL_API_URL]
    : ([] as string[]),

  webUser: process.env.EXPO_PUBLIC_WEB_USER || 'dashboard',
  webPassword: process.env.EXPO_PUBLIC_WEB_PASSWORD || '',

  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY || '',
  userId: process.env.EXPO_PUBLIC_USER_ID || '',

  timeoutMs: 5000,
};

function encodeBasicAuth(user: string, pass: string): string {
  const str = `${user}:${pass}`;
  if (typeof btoa === 'function') {
    return btoa(str);
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let block = 0, charCode, i = 0, map = chars;
    str.charAt(i | 0) || (map = '=', i % 1);
    output += map.charAt(63 & block >> 8 - i % 1 * 8)) {
    charCode = str.charCodeAt(i += 3 / 4);
    if (charCode > 0xFF) {
      throw new Error("Invalid Latin1 character in credentials");
    }
    block = block << 8 | charCode;
  }
  return output;
}

interface RawSample {
  id: number;
  sampleId?: string;
  sample_id?: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measuredAt?: string;
  measured_at?: string;
  receivedAt?: string;
  received_at?: string;
}

function normalizeSamples(raw: RawSample[]): DashboardSample[] {
  return raw.map((r) => ({
    id: r.id,
    sampleId: r.sampleId || r.sample_id || `sample-${r.id}`,
    metric: r.metric,
    value: Number(r.value),
    unit: r.unit,
    measuredAt: r.measuredAt || r.measured_at || new Date().toISOString(),
    receivedAt: r.receivedAt || r.received_at || new Date().toISOString(),
  }));
}

let activeLocalUrl: string | null = null;
let localProbeCooldownUntil = 0;
const LOCAL_COOLDOWN_MS = 30000;

async function fetchLocalSamples(path: string, authHeader: string): Promise<RawSample[] | null> {
  const now = Date.now();
  if (!activeLocalUrl && now < localProbeCooldownUntil) {
    return null;
  }

  const urls = activeLocalUrl ? [activeLocalUrl] : API_CONFIG.localUrls;
  for (const baseUrl of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const res = await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          activeLocalUrl = baseUrl;
          return data;
        }
      }
    } catch {
      if (activeLocalUrl === baseUrl) {
        activeLocalUrl = null;
      }
    }
  }

  if (!activeLocalUrl) {
    localProbeCooldownUntil = Date.now() + LOCAL_COOLDOWN_MS;
  }
  return null;
}

/**
 * Consulta las muestras reales del usuario desde el backend NestJS o Supabase Cloud.
 */
export async function fetchDashboardSamples(limit = 100): Promise<DashboardSample[]> {
  const authHeader = `Basic ${encodeBasicAuth(API_CONFIG.webUser, API_CONFIG.webPassword)}`;

  const localData = await fetchLocalSamples(`/dashboard/data?limit=${limit}`, authHeader);
  if (localData) {
    return normalizeSamples(localData);
  }

  // 2. Conexión directa a Supabase Cloud con datos reales
  const supabaseEndpoint = `${API_CONFIG.supabaseUrl}/rest/v1/samples?select=*&user_id=eq.${API_CONFIG.userId}&order=measured_at.desc&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    const res = await fetch(supabaseEndpoint, {
      method: 'GET',
      headers: {
        apikey: API_CONFIG.supabaseKey,
        Authorization: `Bearer ${API_CONFIG.supabaseKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Supabase Error: ${res.status}`);
    }

    const data = await res.json();
    return normalizeSamples(data);
  } catch (error) {
    clearTimeout(timer);
    throw error;
  }
}

/**
 * Consulta el historial de una métrica específica (heart_rate, spo2, stress, steps)
 * desde el backend NestJS o directamente desde Supabase Cloud.
 */
export async function fetchMetricHistory(
  metric: SampleMetric,
  limit = 300
): Promise<DashboardSample[]> {
  const authHeader = `Basic ${encodeBasicAuth(API_CONFIG.webUser, API_CONFIG.webPassword)}`;

  const localData = await fetchLocalSamples(
    `/dashboard/data?limit=${limit}&metric=${metric}`,
    authHeader
  );
  if (localData) {
    return normalizeSamples(localData);
  }

  const supabaseEndpoint = `${API_CONFIG.supabaseUrl}/rest/v1/samples?select=*&user_id=eq.${API_CONFIG.userId}&metric=eq.${metric}&order=measured_at.desc&limit=${limit}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    const res = await fetch(supabaseEndpoint, {
      method: 'GET',
      headers: {
        apikey: API_CONFIG.supabaseKey,
        Authorization: `Bearer ${API_CONFIG.supabaseKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const data = await res.json();
    return normalizeSamples(data);
  } catch {
    return [];
  }
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
