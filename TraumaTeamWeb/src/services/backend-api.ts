import { parseHealthAlerts, HealthAlertsNotReadyError, isHealthAlertsNotReadyResponse, type HealthAlert } from '../../../shared/health-alerts.ts';
import type {
  BodyConditionImageRecord,
  BodyConditionRecord,
  BodyProfile,
  DailyHealthCheck,
  DailyMetricSummary,
  DashboardSample,
  InjuryPhoto,
  SampleMetric,
  SaveBodyConditionPayload,
  VitalSignsData,
  WeightRecord,
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

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
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
    throw new Error('The backend URL is not configured in .env (EXPO_PUBLIC_LOCAL_API_URL).');
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
 * Fetches real biometric samples of the configured astronaut.
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
        throw new Error('The backend returned samples in an unexpected format.');
      }
      return json;
    }

    if (res.status !== 401 || !runtimeConfig.apiToken) {
      throw new ApiRequestError(
        res.status,
        res.status === 401
          ? 'Web credentials rejected at /dashboard/data (401).'
          : `Error fetching samples (${res.status}).`
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
          ? 'API token rejected at /dashboard/samples (401).'
          : `Error fetching /dashboard/samples (${res.status}).`
      );
    }
    const json: unknown = await res.json();
    if (!Array.isArray(json) || !json.every(isDashboardSample)) {
      throw new Error('The backend returned samples in an unexpected format.');
    }
    return json;
  }

  throw new ApiRequestError(401, 'No web password or API token is configured.');
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
    'A DASHBOARD_API_TOKEN token is required to access this resource.'
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
        ? 'Access protected with Bearer DASHBOARD_API_TOKEN at /dashboard/body-conditions (401).'
        : `Could not load the 3D injuries (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body) || !body.every(isBodyConditionRecord)) {
    throw new Error('Invalid format received from /dashboard/body-conditions.');
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
        ? 'Unauthorized (401). Set DASHBOARD_API_TOKEN in the Backend Connection to save medical changes.'
        : `Could not save the risk level (${res.status}).`
    );
  }

  const body: unknown = await res.json();
  if (!isBodyConditionRecord(body)) {
    throw new Error('The backend returned an invalid anatomical record on save.');
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
        ? 'Unauthorized (401). Set DASHBOARD_API_TOKEN to resolve injuries.'
        : `Could not resolve the injury (${res.status}).`
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
        ? 'Access protected with a token at /dashboard/body-conditions/images (401).'
        : `Could not load the condition photos (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body) || !body.every(isBodyConditionImageRecord)) {
    throw new Error('Invalid format received from /dashboard/body-conditions/images.');
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
        ? 'Unauthorized (401). Set DASHBOARD_API_TOKEN to upload photos.'
        : `Could not upload the image (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!isBodyConditionImageRecord(body)) {
    throw new Error('Invalid response when uploading the condition image.');
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
        ? 'Access protected with Bearer DASHBOARD_API_TOKEN at /dashboard/health-checks (401).'
        : `Could not load the daily questionnaires (${res.status}).`
    );
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    throw new Error('Invalid format received from /dashboard/health-checks.');
  }
  const parsedChecks: DailyHealthCheck[] = [];
  for (const item of body) {
    const parsed = parseDailyHealthCheck(item);
    if (!parsed) {
      throw new Error('Invalid format received from /dashboard/health-checks.');
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
      formattedTime = `${Math.max(1, diffSec)} sec ago`;
    } else if (diffSec < 3600 && diffSec >= 0) {
      formattedTime = `${Math.floor(diffSec / 60)} min ago`;
    } else {
      const h = String(latestDate.getHours()).padStart(2, '0');
      const m = String(latestDate.getMinutes()).padStart(2, '0');
      formattedTime = `${latestDate.toLocaleDateString('en-US')} · ${h}:${m}`;
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

  const shortDate = `${MONTHS_EN[m - 1] ?? ''} ${d}`;
  if (dateKey === todayKey) return `Today · ${shortDate}`;
  if (dateKey === yesterdayKey) return `Yesterday · ${shortDate}`;
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


export async function fetchHealthAlerts(): Promise<HealthAlert[]> {
  const res = await fetchWithBearerOrBasic(resolveUrl('/dashboard/alerts/monitor'), { method: 'GET', cache: 'no-store' });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    if (res.status === 503 && isHealthAlertsNotReadyResponse(body)) throw new HealthAlertsNotReadyError();
    throw new ApiRequestError(res.status, `Could not load alerts (${res.status}).`);
  }
  return parseHealthAlerts(await res.json());
}

export async function acknowledgeHealthAlert(id: string): Promise<void> {
  const res = await fetchWithBearerOrBasic(resolveUrl(`/dashboard/alerts/monitor/${encodeURIComponent(id)}/acknowledge`), { method: 'POST' });
  if (!res.ok) throw new ApiRequestError(res.status, `Could not acknowledge this alert (${res.status}).`);
  const result: unknown = await res.json();
  if (!isRecord(result) || result.acknowledged !== true) throw new Error('Invalid acknowledgement response.');
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isNullableNumber = (value: unknown): boolean => value === null || isFiniteNumber(value);

function isWeightRecord(value: unknown): value is WeightRecord {
  if (!isRecord(value)) return false;
  if (!isFiniteNumber(value.id) || typeof value.measurementId !== 'string') return false;
  if (!isFiniteNumber(value.weightKg) || !(value.device === null || typeof value.device === 'string')) return false;
  if (typeof value.measuredAt !== 'string' || typeof value.receivedAt !== 'string') return false;
  if (value.metrics === null) return true;
  if (!isRecord(value.metrics) || !isRecord(value.metrics.exact)) return false;
  const { exact, estimated } = value.metrics;
  const exactOk =
    ['bmi', 'healthyWeightMinKg', 'healthyWeightMaxKg', 'overweightMaxKg'].every((key) => isFiniteNumber(exact[key])) &&
    typeof exact.bmiCategory === 'string' &&
    isNullableNumber(exact.idealWeightKg) &&
    isNullableNumber(exact.weightToIdealKg);
  const estimatedOk =
    estimated === null ||
    (isRecord(estimated) &&
      ['bodyFatPercent', 'fatMassKg', 'leanMassKg', 'bodyWaterLiters', 'bodyWaterPercent', 'basalMetabolismKcal']
        .every((key) => isFiniteNumber(estimated[key])));
  return exactOk && estimatedOk;
}

function isBodyProfile(value: unknown): value is BodyProfile {
  return (
    isRecord(value) &&
    isFiniteNumber(value.heightCm) &&
    isNullableNumber(value.ageYears) &&
    (value.sex === null || value.sex === 'male' || value.sex === 'female') &&
    typeof value.updatedAt === 'string'
  );
}

/** Latest smart-scale weighing with its body metrics, or null when there is none yet. */
export async function fetchLatestWeightFromBackend(): Promise<WeightRecord | null> {
  const url = resolveUrl('/dashboard/weights', { limit: '1' });
  const res = await fetchWithBearerOrBasic(url, { method: 'GET' });
  if (!res.ok) {
    throw new ApiRequestError(res.status, `Could not load the scale weighings (${res.status}).`);
  }
  const body: unknown = await res.json();
  if (!Array.isArray(body) || !body.every(isWeightRecord)) {
    throw new Error('Invalid format received from /dashboard/weights.');
  }
  return body[0] ?? null;
}

/** Height, age and sex used by the scale metrics, or null when no profile has been set. */
export async function fetchBodyProfileFromBackend(): Promise<BodyProfile | null> {
  const res = await fetchWithBearerOrBasic(resolveUrl('/dashboard/body-profile'), { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new ApiRequestError(res.status, `Could not load the body profile (${res.status}).`);
  }
  const body: unknown = await res.json();
  if (!isBodyProfile(body)) {
    throw new Error('Invalid format received from /dashboard/body-profile.');
  }
  return body;
}
