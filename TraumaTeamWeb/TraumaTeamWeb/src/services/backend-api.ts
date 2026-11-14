import type {
  BodyConditionImageRecord,
  BodyConditionRecord,
  DailyHealthCheck,
  DailyMetricSummary,
  DashboardSample,
  InjuryPhoto,
  SampleMetric,
  SaveBodyConditionPayload,
  VitalSignsData,
} from '../types/dashboard';

export interface BackendRuntimeConfig {
  apiBaseUrl: string;
  webUser: string;
  webPassword: string;
  userId: string;
  apiToken: string;
}

const env = import.meta.env ?? {};

const DEFAULT_CONFIG: BackendRuntimeConfig = {
  apiBaseUrl:
    env.VITE_API_BASE_URL ||
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.EXPO_PUBLIC_LOCAL_API_URL ||
    '',
  webUser: env.EXPO_PUBLIC_WEB_USER || 'dashboard',
  webPassword: env.EXPO_PUBLIC_WEB_PASSWORD || '',
  userId: env.EXPO_PUBLIC_USER_ID || '',
  apiToken:
    env.VITE_DASHBOARD_API_TOKEN ||
    env.EXPO_PUBLIC_DASHBOARD_API_TOKEN ||
    env.DASHBOARD_API_TOKEN ||
    '',
};

let runtimeConfig: BackendRuntimeConfig = { ...DEFAULT_CONFIG };

export function getBackendConfig(): BackendRuntimeConfig {
  return { ...runtimeConfig };
}

export function updateBackendConfig(partial: Partial<BackendRuntimeConfig>): BackendRuntimeConfig {
  runtimeConfig = {
    ...runtimeConfig,
    ...partial,
  };
  return getBackendConfig();
}

export function resetBackendConfig(): BackendRuntimeConfig {
  runtimeConfig = { ...DEFAULT_CONFIG };
  return getBackendConfig();
}

const SAMPLE_METRICS: readonly SampleMetric[] = [
  'heart_rate',
  'stress',
  'spo2',
  'steps',
  'sleep',
];

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const REQUEST_TIMEOUT_MS = 6500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildBasicHeader(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `Basic ${btoa(binary)}`;
}

function isDashboardSample(value: unknown): value is DashboardSample {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    typeof value.sampleId === 'string' &&
    SAMPLE_METRICS.some((m) => m === value.metric) &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    typeof value.unit === 'string' &&
    typeof value.measuredAt === 'string' &&
    typeof value.receivedAt === 'string'
  );
}

function isBodyConditionRecord(value: unknown): value is BodyConditionRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.muscleId === 'string' &&
    typeof value.bodyRegion === 'string' &&
    typeof value.muscleName === 'string' &&
    typeof value.conditionName === 'string' &&
    (typeof value.description === 'string' || value.description === null) &&
    typeof value.painIntensity === 'number' &&
    Number.isInteger(value.painIntensity) &&
    typeof value.swelling === 'boolean' &&
    typeof value.functionalLimitation === 'boolean' &&
    (value.status === 'active' || value.status === 'resolved') &&
    typeof value.recordedAt === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (typeof value.resolvedAt === 'string' || value.resolvedAt === null)
  );
}

function parseNullableFiniteNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseDailyHealthCheck(value: unknown): DailyHealthCheck | null {
  if (!isRecord(value)) return null;
  const bloodSugarMgDl = parseNullableFiniteNumber(value.bloodSugarMgDl);
  const systolicBp = parseNullableFiniteNumber(value.systolicBp);
  const diastolicBp = parseNullableFiniteNumber(value.diastolicBp);
  const temperatureC = parseNullableFiniteNumber(value.temperatureC);
  const sleepHours = parseNullableFiniteNumber(value.sleepHours);

  if (
    typeof value.id !== 'string' ||
    typeof value.dateIso !== 'string' ||
    bloodSugarMgDl === undefined ||
    systolicBp === undefined ||
    diastolicBp === undefined ||
    temperatureC === undefined ||
    sleepHours === undefined ||
    typeof value.mood !== 'number' ||
    !Number.isFinite(value.mood) ||
    !Array.isArray(value.symptoms) ||
    !value.symptoms.every((s) => typeof s === 'string') ||
    (typeof value.notes !== 'string' && value.notes !== null && value.notes !== undefined) ||
    (value.overallStatus !== 'normal' &&
      value.overallStatus !== 'warning' &&
      value.overallStatus !== 'critical') ||
    typeof value.recommendation !== 'string' ||
    typeof value.recordedAt !== 'string'
  ) {
    return null;
  }

  const notes: string = typeof value.notes === 'string' ? value.notes : '';

  return {
    id: value.id,
    dateIso: value.dateIso,
    bloodSugarMgDl,
    systolicBp,
    diastolicBp,
    temperatureC,
    sleepHours,
    mood: value.mood as DailyHealthCheck['mood'],
    symptoms: value.symptoms,
    notes,
    overallStatus: value.overallStatus,
    recommendation: value.recommendation,
    recordedAt: value.recordedAt,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : value.recordedAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : value.recordedAt,
  };
}

function isBodyConditionImageRecord(value: unknown): value is BodyConditionImageRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.path === 'string' &&
    typeof value.signedUrl === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function resolveUrl(path: string, params?: Record<string, string>): string {
  const base = runtimeConfig.apiBaseUrl.trim();
  if (!base) {
    throw new Error('Falta configurar la URL del backend en .env (EXPO_PUBLIC_LOCAL_API_URL).');
  }
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(resolveUrl('/health'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Obtiene muestras biométricas reales del astronauta configurado.
 * Usa /dashboard/data con HTTP Basic Auth (.env) y respalda con /dashboard/samples si hay Bearer token.
 */
export async function fetchSamplesFromBackend(
  limit = 500,
  metric?: SampleMetric
): Promise<DashboardSample[]> {
  const params: Record<string, string> = { limit: String(limit) };
  if (metric) params.metric = metric;

  if (runtimeConfig.webPassword) {
    const res = await fetchWithTimeout(resolveUrl('/dashboard/data', params), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: buildBasicHeader(runtimeConfig.webUser, runtimeConfig.webPassword),
      },
    });

    if (res.ok) {
      const json: unknown = await res.json();
      if (!Array.isArray(json) || !json.every(isDashboardSample)) {
        throw new Error('El backend devolvió muestras con formato inesperado.');
      }
      return json;
    }

    if (res.status !== 401 || !runtimeConfig.apiToken) {
      throw new ApiRequestError(
        res.status,
        res.status === 401
          ? 'Credenciales web rechazadas en /dashboard/data (401).'
          : `Error al consultar muestras (${res.status}).`
      );
    }
  }

  if (runtimeConfig.apiToken) {
    const res = await fetchWithTimeout(resolveUrl('/dashboard/samples', params), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${runtimeConfig.apiToken}`,
      },
    });
    if (!res.ok) {
      throw new ApiRequestError(
        res.status,
        res.status === 401
          ? 'Token de API rechazado en /dashboard/samples (401).'
          : `Error al consultar /dashboard/samples (${res.status}).`
      );
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json) || !json.every(isDashboardSample)) {
      throw new Error('El backend devolvió muestras con formato inesperado.');
    }
    return json;
  }

  throw new ApiRequestError(401, 'No hay contraseña web ni token API configurados.');
}

async function fetchWithBearerOrBasic(url: string, init: RequestInit): Promise<Response> {
  const token = runtimeConfig.apiToken.trim();
  if (token) {
    const res = await fetchWithTimeout(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status !== 401) return res;
  }

  if (runtimeConfig.webPassword) {
    return fetchWithTimeout(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        Authorization: buildBasicHeader(runtimeConfig.webUser, runtimeConfig.webPassword),
      },
    });
  }

  throw new ApiRequestError(
    401,
    'Se requiere token DASHBOARD_API_TOKEN para acceder a este recurso.'
  );
}

export async function fetchBodyConditionsFromBackend(
  limit = 500
): Promise<BodyConditionRecord[]> {
  const url = resolveUrl('/dashboard/body-conditions', { limit: String(limit) });
  const res = await fetchWithBearerOrBasic(url, { method: 'GET' });
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      res.status === 401
        ? 'Acceso protegido con Bearer DASHBOARD_API_TOKEN en /dashboard/body-conditions (401).'
        : `No se pudieron cargar las lesiones 3D (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body) || !body.every(isBodyConditionRecord)) {
    throw new Error('Formato inválido recibido desde /dashboard/body-conditions.');
  }
  return body;
}

export async function saveBodyConditionToBackend(
  muscleId: string,
  payload: SaveBodyConditionPayload
): Promise<BodyConditionRecord> {
  const url = resolveUrl(`/dashboard/body-conditions/${encodeURIComponent(muscleId)}`);
  const res = await fetchWithBearerOrBasic(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bodyRegion: payload.bodyRegion,
      muscleName: payload.muscleName,
      conditionName: payload.conditionName,
      description: payload.description,
      painIntensity: payload.painIntensity,
      swelling: payload.swelling,
      functionalLimitation: payload.functionalLimitation,
    }),
  });

  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      res.status === 401
        ? 'No autorizado (401). Configura DASHBOARD_API_TOKEN en Conexión Backend para guardar cambios médicos.'
        : `No se pudo guardar el nivel de riesgo (${res.status}).`
    );
  }

  const body: unknown = await res.json();
  if (!isBodyConditionRecord(body)) {
    throw new Error('El backend devolvió un registro anatómico inválido al guardar.');
  }
  return body;
}

export async function resolveBodyConditionInBackend(muscleId: string): Promise<void> {
  const url = resolveUrl(`/dashboard/body-conditions/${encodeURIComponent(muscleId)}`);
  const res = await fetchWithBearerOrBasic(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      res.status === 401
        ? 'No autorizado (401). Configura DASHBOARD_API_TOKEN para resolver lesiones.'
        : `No se pudo resolver la lesión (${res.status}).`
    );
  }
}

export async function cureBodyConditionWithHistoryInBackend(
  muscleId: string,
  finalPayload: SaveBodyConditionPayload
): Promise<void> {
  const clampedPain = Math.max(1, Math.min(10, Math.round(finalPayload.painIntensity || 1)));
  await saveBodyConditionToBackend(muscleId, {
    ...finalPayload,
    painIntensity: clampedPain,
  });
  await resolveBodyConditionInBackend(muscleId);
}

export async function fetchBodyConditionImagesFromBackend(
  muscleId: string
): Promise<BodyConditionImageRecord[]> {
  const url = resolveUrl(`/dashboard/body-conditions/${encodeURIComponent(muscleId)}/images`);
  const res = await fetchWithBearerOrBasic(url, { method: 'GET' });
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      res.status === 401
        ? 'Acceso protegido con token en /dashboard/body-conditions/images (401).'
        : `No se pudieron cargar las fotos del padecimiento (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body) || !body.every(isBodyConditionImageRecord)) {
    throw new Error('Formato inválido recibido desde /dashboard/body-conditions/images.');
  }
  return body;
}

export async function uploadBodyConditionImageToBackend(
  muscleId: string,
  file: File
): Promise<BodyConditionImageRecord> {
  const url = resolveUrl(`/dashboard/body-conditions/${encodeURIComponent(muscleId)}/images`);
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetchWithBearerOrBasic(url, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      res.status === 401
        ? 'No autorizado (401). Configura DASHBOARD_API_TOKEN para subir fotos.'
        : `No se pudo subir la imagen (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!isBodyConditionImageRecord(body)) {
    throw new Error('Respuesta inválida al subir imagen de padecimiento.');
  }
  return body;
}

export async function fetchDailyHealthChecksFromBackend(
  limit = 100
): Promise<DailyHealthCheck[]> {
  const url = resolveUrl('/dashboard/health-checks', { limit: String(limit) });
  const res = await fetchWithBearerOrBasic(url, { method: 'GET' });
  if (!res.ok) {
    throw new ApiRequestError(
      res.status,
      res.status === 401
        ? 'Acceso protegido con Bearer DASHBOARD_API_TOKEN en /dashboard/health-checks (401).'
        : `No se pudieron cargar los cuestionarios diarios (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    throw new Error('Formato inválido recibido desde /dashboard/health-checks.');
  }
  const parsedChecks: DailyHealthCheck[] = [];
  for (const item of body) {
    const parsed = parseDailyHealthCheck(item);
    if (!parsed) {
      throw new Error('Formato inválido recibido desde /dashboard/health-checks.');
    }
    parsedChecks.push(parsed);
  }
  return parsedChecks;
}

export async function fetchInjuryPhotosFromBackend(
  muscle: { id: string; name: string },
  signal: AbortSignal
): Promise<InjuryPhoto[]> {
  const token = runtimeConfig.apiToken.trim();
  if (!token) throw new ApiRequestError(401, 'A dashboard API token is required to view photos.');
  const url = resolveUrl(`/dashboard/body-conditions/${encodeURIComponent(muscle.id)}/images`);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    signal: AbortSignal.any([signal, AbortSignal.timeout(40000)]),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new ApiRequestError(response.status, response.status === 401
      ? 'Photo access was denied. Check the dashboard connection credentials.'
      : 'Photos could not be loaded. Please try again.');
  }
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error('The backend returned an invalid photo list.');
  return body.map((image: unknown) => {
    if (!isRecord(image) || typeof image.path !== 'string' ||
      image.path.split('/').length !== 3 || image.path.split('/')[1] !== muscle.id ||
      typeof image.signedUrl !== 'string' || typeof image.expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(image.expiresAt)) || Date.parse(image.expiresAt) <= Date.now()) {
      throw new Error('The backend returned an invalid or expired photo link. Please reload photos.');
    }
    const signedUrl = new URL(image.signedUrl);
    if (signedUrl.protocol !== 'https:' || signedUrl.username || signedUrl.password) {
      throw new Error('The backend returned an invalid photo link.');
    }
    return {
      id: image.path, muscleId: muscle.id, muscleName: muscle.name,
      uri: signedUrl.toString(), dayNumber: null, capturedAt: null,
    };
  });
}

export function extractLatestVitals(samples: DashboardSample[]): VitalSignsData {
  let heartRate: number | null = null;
  let spo2: number | null = null;
  let stress: number | null = null;
  let sleepHours: number | null = null;
  let steps: number | null = null;
  let latestDate: Date | null = null;

  const pulseHistory: DashboardSample[] = [];
  const spo2History: DashboardSample[] = [];
  const stressHistory: DashboardSample[] = [];
  const sleepHistory: DashboardSample[] = [];
  const stepsHistory: DashboardSample[] = [];

  for (const s of samples) {
    const measuredDate = new Date(s.measuredAt);
    if (!Number.isNaN(measuredDate.getTime()) && (!latestDate || measuredDate > latestDate)) {
      latestDate = measuredDate;
    }

    if (s.metric === 'heart_rate') {
      pulseHistory.push(s);
      if (heartRate === null) heartRate = Math.round(s.value);
    } else if (s.metric === 'spo2') {
      spo2History.push(s);
      if (spo2 === null) spo2 = Math.round(s.value);
    } else if (s.metric === 'stress') {
      stressHistory.push(s);
      if (stress === null) stress = Math.round(s.value);
    } else if (s.metric === 'sleep') {
      sleepHistory.push(s);
      if (sleepHours === null) sleepHours = s.value;
    } else if (s.metric === 'steps') {
      stepsHistory.push(s);
      if (steps === null) steps = Math.round(s.value);
    }
  }

  let formattedTime: string | undefined;
  let lastMeasuredIso: string | undefined;
  if (latestDate && !Number.isNaN(latestDate.getTime())) {
    lastMeasuredIso = latestDate.toISOString();
    const diffSec = Math.floor((Date.now() - latestDate.getTime()) / 1000);
    if (diffSec < 60 && diffSec >= 0) {
      formattedTime = `Hace ${Math.max(1, diffSec)} seg`;
    } else if (diffSec < 3600 && diffSec >= 0) {
      formattedTime = `Hace ${Math.floor(diffSec / 60)} min`;
    } else {
      const h = String(latestDate.getHours()).padStart(2, '0');
      const m = String(latestDate.getMinutes()).padStart(2, '0');
      formattedTime = `${latestDate.toLocaleDateString('es-MX')} · ${h}:${m}`;
    }
  }

  return {
    heartRate,
    spo2,
    stress,
    steps,
    sleepHours,
    lastMeasuredAt: formattedTime,
    lastMeasuredIso,
    isAvailable: heartRate !== null && heartRate > 0,
    pulseHistory,
    spo2History,
    stressHistory,
    sleepHistory,
    stepsHistory,
  };
}

export function getInitialEmptyVitals(): VitalSignsData {
  return {
    heartRate: null,
    spo2: null,
    stress: null,
    steps: null,
    sleepHours: null,
    lastMeasuredAt: undefined,
    lastMeasuredIso: undefined,
    isAvailable: false,
    pulseHistory: [],
    spo2History: [],
    stressHistory: [],
    sleepHistory: [],
    stepsHistory: [],
  };
}

function formatHourMinute(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(yesterday.getDate()).padStart(2, '0')}`;

  const shortDate = `${d} ${MONTHS_ES[m - 1] ?? ''}`;
  if (dateKey === todayKey) return `Hoy · ${shortDate}`;
  if (dateKey === yesterdayKey) return `Ayer · ${shortDate}`;
  return `${shortDate} ${y}`;
}

export function groupSamplesByDay(samples: DashboardSample[]): DailyMetricSummary[] {
  const groups = new Map<string, DashboardSample[]>();

  for (const s of samples) {
    const dt = new Date(s.measuredAt);
    if (Number.isNaN(dt.getTime())) continue;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
      dt.getDate()
    ).padStart(2, '0')}`;
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  const summaries: DailyMetricSummary[] = [];
  for (const [dateKey, list] of groups.entries()) {
    const isSleep = list[0]?.metric === 'sleep';
    let maxSample = list[0];
    let minSample = list[0];
    let sum = 0;

    for (const item of list) {
      sum += item.value;
      if (item.value > maxSample.value) maxSample = item;
      if (item.value < minSample.value) minSample = item;
    }

    summaries.push({
      dateKey,
      dateLabel: formatDayLabel(dateKey),
      count: list.length,
      avg: isSleep ? Math.round((sum / list.length) * 10) / 10 : Math.round(sum / list.length),
      max: isSleep ? maxSample.value : Math.round(maxSample.value),
      maxTime: formatHourMinute(maxSample.measuredAt),
      min: isSleep ? minSample.value : Math.round(minSample.value),
      minTime: formatHourMinute(minSample.measuredAt),
    });
  }

  return summaries.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}

export interface AstronautLocationBackendResponse {
  entorno: 'tierra' | 'nave' | 'estacion' | 'luna' | 'marte';
  environment: 'tierra' | 'nave' | 'estacion' | 'luna' | 'marte';
  label: string;
  gravityLabel: string;
  actualizadoEn?: string;
}

export async function fetchAstronautLocationFromBackend(): Promise<AstronautLocationBackendResponse | null> {
  try {
    const url = resolveUrl('/dashboard/astronaut/location');
    const res = await fetchWithBearerOrBasic(url, { method: 'GET' });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (isRecord(data)) {
      const raw = String(data.entorno ?? data.environment ?? '').toLowerCase().trim();
      let entorno:
        | 'tierra'
        | 'nave'
        | 'estacion'
        | 'luna'
        | 'marte'
        | null = null;
      if (raw === 'tierra' || raw === 'earth') entorno = 'tierra';
      else if (raw === 'nave' || raw === 'spaceship' || raw === 'ship') entorno = 'nave';
      else if (raw === 'estacion' || raw === 'station') entorno = 'estacion';
      else if (raw === 'luna' || raw === 'moon') entorno = 'luna';
      else if (raw === 'marte' || raw === 'mars') entorno = 'marte';

      if (entorno) {
        return {
          entorno,
          environment: entorno,
          label: (data.etiqueta as string) || (data.label as string) || entorno,
          gravityLabel:
            (data.gravedadEtiqueta as string) || (data.gravityLabel as string) || '',
          actualizadoEn:
            (data.actualizadoEn as string) || (data.actualizado_en as string) || '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

