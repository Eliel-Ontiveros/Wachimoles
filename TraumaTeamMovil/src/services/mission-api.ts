import { API_CONFIG } from './vital-signs-api';
import {
  DailyHealthCheck,
  DailyMission,
  EnvironmentConfig,
  EnvironmentType,
  InjuryPhoto,
  SpaceLocation,
} from '../types/mission';

// Servicio preparado para conectar misiones, entorno y fotos de lesiones con el backend

export interface BodyConditionSyncInput {
  muscleId: string;
  bodyRegion: string;
  muscleName: string;
  observation: {
    painIntensity: number;
    swelling: boolean;
    functionalLimitation: boolean;
    notes: string;
  } | null;
}

export interface BodyConditionRecord {
  id: string;
  muscleId: string;
  bodyRegion: string;
  muscleName: string;
  conditionName: string;
  description: string | null;
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
  status: 'active' | 'resolved';
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

type DailyHealthCheckRecord = Omit<DailyHealthCheck, 'notes'> & {
  notes: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function encodeBase64Ascii(input: string): string {
  if (typeof globalThis.btoa === 'function') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return globalThis.btoa(binary);
  }
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = new TextEncoder().encode(input);
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    output += i + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? chars[triplet & 0x3f] : '=';
  }
  return output;
}

function getMobileFallbackAuthHeaders(): Record<string, string>[] {
  const headersList: Record<string, string>[] = [];
  if (API_CONFIG.dashboardApiToken) {
    headersList.push({
      Accept: 'application/json',
      Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
    });
  }
  const webUser = (process.env.EXPO_PUBLIC_WEB_USER || '').trim();
  const webPassword = (process.env.EXPO_PUBLIC_WEB_PASSWORD || '').trim();
  if (webUser && webPassword) {
    headersList.push({
      Accept: 'application/json',
      Authorization: `Basic ${encodeBase64Ascii(`${webUser}:${webPassword}`)}`,
    });
  }
  return headersList;
}

function normalizeBodyConditionRecord(
  value: unknown
): BodyConditionRecord | null {
  if (!isRecord(value)) return null;

  const id = value.id;
  const muscleId = value.muscleId ?? value.muscle_id;
  const bodyRegion = value.bodyRegion ?? value.body_region;
  const muscleName = value.muscleName ?? value.muscle_name;
  const conditionName =
    value.conditionName ?? value.condition_name ?? 'Dolor muscular';
  const rawDescription = value.description;
  const rawPain = value.painIntensity ?? value.pain_intensity;
  const painIntensity =
    typeof rawPain === 'number' ? rawPain : Number(rawPain);
  const swelling = value.swelling;
  const functionalLimitation =
    value.functionalLimitation ?? value.functional_limitation;
  const status = value.status;
  const recordedAt = value.recordedAt ?? value.recorded_at ?? '';
  const createdAt = value.createdAt ?? value.created_at ?? recordedAt;
  const updatedAt = value.updatedAt ?? value.updated_at ?? recordedAt;
  const resolvedAt = value.resolvedAt ?? value.resolved_at ?? null;

  if (
    typeof id !== 'string' ||
    typeof muscleId !== 'string' ||
    typeof bodyRegion !== 'string' ||
    typeof muscleName !== 'string' ||
    typeof conditionName !== 'string' ||
    (typeof rawDescription !== 'string' && rawDescription !== null) ||
    !Number.isFinite(painIntensity) ||
    painIntensity < 0 ||
    painIntensity > 10 ||
    typeof swelling !== 'boolean' ||
    typeof functionalLimitation !== 'boolean' ||
    (status !== 'active' && status !== 'resolved') ||
    typeof recordedAt !== 'string' ||
    typeof createdAt !== 'string' ||
    typeof updatedAt !== 'string' ||
    (typeof resolvedAt !== 'string' && resolvedAt !== null)
  ) {
    return null;
  }

  return {
    id,
    muscleId,
    bodyRegion,
    muscleName,
    conditionName,
    description: rawDescription,
    painIntensity: Math.round(painIntensity),
    swelling,
    functionalLimitation,
    status,
    recordedAt,
    createdAt,
    updatedAt,
    resolvedAt,
  };
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isDailyHealthCheckRecord(
  value: unknown
): value is DailyHealthCheckRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.dateIso === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.dateIso) &&
    isNullableFiniteNumber(value.bloodSugarMgDl) &&
    isNullableFiniteNumber(value.systolicBp) &&
    isNullableFiniteNumber(value.diastolicBp) &&
    isNullableFiniteNumber(value.temperatureC) &&
    isNullableFiniteNumber(value.sleepHours) &&
    typeof value.mood === 'number' &&
    Number.isInteger(value.mood) &&
    value.mood >= 1 &&
    value.mood <= 5 &&
    Array.isArray(value.symptoms) &&
    value.symptoms.every((symptom) => typeof symptom === 'string') &&
    (typeof value.notes === 'string' || value.notes === null) &&
    (value.overallStatus === 'normal' ||
      value.overallStatus === 'warning' ||
      value.overallStatus === 'critical') &&
    typeof value.recommendation === 'string' &&
    typeof value.recordedAt === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

export const SPACE_LOCATIONS: Record<
  SpaceLocation,
  { id: SpaceLocation; label: string; shortLabel: string }
> = {
  tierra: { id: 'tierra', label: 'Tierra', shortLabel: 'Tierra' },
  nave: { id: 'nave', label: 'Estación Orbital', shortLabel: 'Estación' },
  luna: { id: 'luna', label: 'Base Lunar', shortLabel: 'Luna' },
  marte: { id: 'marte', label: 'Superficie de Marte', shortLabel: 'Marte' },
};

const ROUTE_DAYS: Record<string, number> = {
  'tierra:nave': 30,
  'nave:tierra': 30,
  'tierra:luna': 45,
  'luna:tierra': 45,
  'tierra:marte': 180,
  'marte:tierra': 180,
  'nave:luna': 15,
  'luna:nave': 15,
  'nave:marte': 150,
  'marte:nave': 150,
  'luna:marte': 135,
  'marte:luna': 135,
};

export function getRouteTotalDays(origin: SpaceLocation, destination: SpaceLocation): number {
  if (origin === destination) {
    if (destination === 'marte') return 180;
    if (destination === 'luna') return 45;
    return 30;
  }
  return ROUTE_DAYS[`${origin}:${destination}`] ?? 45;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateDaysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysToIsoDate(isoDate: string, daysToAdd: number): string {
  const parts = isoDate.trim().split('-').map(Number);
  const base =
    parts.length === 3 && !parts.some((n) => isNaN(n))
      ? new Date(parts[0], parts[1] - 1, parts[2])
      : new Date();
  base.setDate(base.getDate() + daysToAdd);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function diffDaysBetweenIso(startIso: string, endIso: string): number {
  const p1 = startIso.trim().split('-').map(Number);
  const p2 = endIso.trim().split('-').map(Number);
  if (
    p1.length !== 3 ||
    p2.length !== 3 ||
    p1.some((n) => isNaN(n)) ||
    p2.some((n) => isNaN(n))
  ) {
    return 0;
  }
  const d1 = new Date(p1[0], p1[1] - 1, p1[2]);
  const d2 = new Date(p2[0], p2[1] - 1, p2[2]);
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calcula automáticamente el día de misión, llegada estimada o personalizada
 * y ubicación actual del astronauta según salida, destino y fechas (YYYY-MM-DD).
 */
export function calculateMissionStateFromDeparture(
  origin: SpaceLocation,
  destination: SpaceLocation,
  departureDateIso: string,
  arrivalDateIso?: string | null
): {
  elapsedDays: number;
  daysUntilDeparture: number;
  isScheduledFuture: boolean;
  missionDay: number;
  totalDays: number;
  effectiveArrivalDate: string;
  isEstimatedArrival: boolean;
  calculatedEnvironment: EnvironmentType;
  arrived: boolean;
} {
  const defaultTotalDays = getRouteTotalDays(origin, destination);
  const customDays = arrivalDateIso ? diffDaysBetweenIso(departureDateIso, arrivalDateIso) : 0;
  const hasCustomArrival = Boolean(arrivalDateIso && customDays > 0);
  const totalDays = hasCustomArrival ? customDays : defaultTotalDays;
  const effectiveArrivalDate = hasCustomArrival
    ? (arrivalDateIso as string)
    : addDaysToIsoDate(departureDateIso, defaultTotalDays);
  const isEstimatedArrival = !hasCustomArrival;

  const parts = departureDateIso.trim().split('-').map(Number);

  let rawDiffDays = 0;
  if (parts.length === 3 && !parts.some((n) => isNaN(n))) {
    const dep = new Date(parts[0], parts[1] - 1, parts[2]);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffMs = todayMidnight.getTime() - dep.getTime();
    rawDiffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  if (rawDiffDays < 0) {
    return {
      elapsedDays: 0,
      daysUntilDeparture: Math.abs(rawDiffDays),
      isScheduledFuture: true,
      missionDay: 0,
      totalDays,
      effectiveArrivalDate,
      isEstimatedArrival,
      calculatedEnvironment: origin,
      arrived: false,
    };
  }

  const elapsedDays = rawDiffDays;
  const destEnv: EnvironmentType = destination;

  if (origin === destination) {
    return {
      elapsedDays,
      daysUntilDeparture: 0,
      isScheduledFuture: false,
      missionDay: Math.min(totalDays, elapsedDays),
      totalDays,
      effectiveArrivalDate,
      isEstimatedArrival,
      calculatedEnvironment: destEnv,
      arrived: true,
    };
  }

  const missionDay = Math.min(totalDays, elapsedDays);
  const arrived = elapsedDays >= totalDays;

  return {
    elapsedDays,
    daysUntilDeparture: 0,
    isScheduledFuture: false,
    missionDay,
    totalDays,
    effectiveArrivalDate,
    isEstimatedArrival,
    calculatedEnvironment: arrived ? destEnv : 'nave',
    arrived,
  };
}

export const ENVIRONMENTS: Record<EnvironmentType, EnvironmentConfig> = {
  nave: {
    id: 'nave',
    label: 'En la Nave (Órbita)',
    shortLabel: 'Nave',
    gravityLabel: '0g Microgravedad',
    destinationLabel: 'Estación Orbital',
    missionTotalDays: 30,
    dailyStepsGoal: 3000,
    routineSummary: 'Prevención de pérdida ósea y muscular en microgravedad',
  },
  luna: {
    id: 'luna',
    label: 'Base Lunar',
    shortLabel: 'Luna',
    gravityLabel: '0.16g Gravedad Lunar',
    destinationLabel: 'Base Lunar',
    missionTotalDays: 45,
    dailyStepsGoal: 6000,
    routineSummary: 'Movilidad EVA y estabilidad articular en baja gravedad',
  },
  marte: {
    id: 'marte',
    label: 'Superficie de Marte',
    shortLabel: 'Marte',
    gravityLabel: '0.38g Gravedad Marciana',
    destinationLabel: 'Marte',
    missionTotalDays: 180,
    dailyStepsGoal: 8000,
    routineSummary: 'Resistencia de carga, recuperación lumbar y control respiratorio',
  },
  tierra: {
    id: 'tierra',
    label: 'En la Tierra (Base)',
    shortLabel: 'Tierra',
    gravityLabel: '1.0g Gravedad Terrestre',
    destinationLabel: 'Tierra',
    missionTotalDays: 30,
    dailyStepsGoal: 8000,
    routineSummary: 'Acondicionamiento pre-misión y readaptación cardiovascular 1g',
  },
};

export function getMissionsForEnvironment(
  env: EnvironmentType,
  currentSteps: number,
  checkedInToday: boolean,
  treadmillActive = false
): DailyMission[] {
  const goal = ENVIRONMENTS[env].dailyStepsGoal;

  const envRoutines: Record<EnvironmentType, DailyMission[]> = {
    tierra: [
      {
        id: 'env-tierra-cardio',
        title: 'Acondicionamiento aeróbico 1g',
        description: 'Preparación cardiovascular pre-misión o readaptación en Tierra',
        category: 'exercise',
        targetValue: 30,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'tierra',
      },
      {
        id: 'env-tierra-core',
        title: 'Estabilidad vertebral y core',
        description: 'Fortalecimiento postural bajo gravedad terrestre',
        category: 'exercise',
        targetValue: 15,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'tierra',
      },
    ],
    nave: [
      {
        id: 'env-nave-ared',
        title: 'Rutina resistiva ARED',
        description: 'Ejercicios de fuerza para evitar atrofia en 0g',
        category: 'exercise',
        targetValue: 25,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'nave',
      },
      {
        id: 'env-nave-stretch',
        title: 'Descompresión espinal',
        description: 'Estiramiento lumbar y cervical en cabina',
        category: 'exercise',
        targetValue: 10,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'nave',
      },
    ],
    luna: [
      {
        id: 'env-luna-eva',
        title: 'Movilidad post-EVA',
        description: 'Descarga de rodillas y hombros tras caminata lunar',
        category: 'exercise',
        targetValue: 20,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'luna',
      },
      {
        id: 'env-luna-balance',
        title: 'Control postural 0.16g',
        description: 'Ejercicios de equilibrio y tobillo',
        category: 'exercise',
        targetValue: 15,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'luna',
      },
    ],
    marte: [
      {
        id: 'env-marte-load',
        title: 'Entrenamiento de carga 0.38g',
        description: 'Fortalecimiento de cuádriceps y zona dorsal',
        category: 'exercise',
        targetValue: 30,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'marte',
      },
      {
        id: 'env-marte-resp',
        title: 'Control respiratorio y polvo',
        description: 'Revisión de SpO2 y respiración guiada post-hábitat',
        category: 'exercise',
        targetValue: 10,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'marte',
      },
    ],
  };

  const activityMission: DailyMission =
    env === 'nave'
      ? {
        id: 'treadmill-steps',
        title: treadmillActive ? 'Rutina de caminadora T2' : 'Caminadora 0g (Opcional)',
        description: treadmillActive
          ? 'Contando pasos desde el reloj durante la rutina'
          : 'En 0g no hay pasos; actívala si usas caminadora',
        category: 'treadmill',
        targetValue: goal,
        currentValue: treadmillActive ? currentSteps : 0,
        unit: 'pasos',
        completed: treadmillActive && currentSteps >= goal,
        environment: 'nave',
      }
      : {
        id: 'daily-steps',
        title: `Meta de pasos (${ENVIRONMENTS[env].shortLabel})`,
        description: 'Lectura automática desde el smartwatch',
        category: 'steps',
        targetValue: goal,
        currentValue: currentSteps,
        unit: 'pasos',
        completed: currentSteps >= goal,
        environment: env,
      };

  return [
    {
      id: 'daily-checkin',
      title: 'Check-in médico diario',
      description: 'Confirmar estado general para mantener tu racha',
      category: 'checkin',
      targetValue: 1,
      currentValue: checkedInToday ? 1 : 0,
      unit: 'check',
      completed: checkedInToday,
      environment: 'all',
    },
    activityMission,
    ...envRoutines[env],
  ];
}

// Endpoint listo para guardar entorno seleccionado en el backend
export async function syncEnvironmentToBackend(environment: EnvironmentType): Promise<void> {
  const baseUrl = API_CONFIG.localUrls[0];
  try {
    await fetch(`${baseUrl}/mission/environment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: API_CONFIG.userId, environment }),
    });
  } catch {
    // El frontend continúa operando en estado local si el endpoint aún no existe
  }
}

// Endpoint listo para subir foto diaria de lesión/corte al backend
export async function uploadInjuryPhotoToBackend(
  photo: Omit<InjuryPhoto, 'id'>
): Promise<{ synced: boolean }> {
  const baseUrl = API_CONFIG.localUrls[0];
  try {
    const res = await fetch(`${baseUrl}/observations/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: API_CONFIG.userId,
        ...photo,
      }),
    });
    return { synced: res.ok };
  } catch {
    return { synced: false };
  }
}

// Endpoint listo para guardar observación anatómica en el backend
export async function syncObservationToBackend(
  input: BodyConditionSyncInput
): Promise<{ synced: boolean }> {
  if (!API_CONFIG.apiBaseUrl || !API_CONFIG.dashboardApiToken) {
    console.warn(
      'No se pudo sincronizar el padecimiento: falta configurar el backend.'
    );
    return { synced: false };
  }

  const observation = input.observation;
  const shouldResolve = !observation || observation.painIntensity === 0;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    const baseUrl = new URL(API_CONFIG.apiBaseUrl);
    if (
      baseUrl.protocol !== 'https:' &&
      !(__DEV__ && baseUrl.protocol === 'http:')
    ) {
      throw new Error('El backend debe usar HTTPS fuera del modo de desarrollo.');
    }

    const url = new URL(
      `/dashboard/body-conditions/${encodeURIComponent(input.muscleId)}`,
      baseUrl
    );
    const response = await fetch(url.toString(), {
      method: shouldResolve ? 'DELETE' : 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
        ...(shouldResolve ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(shouldResolve
        ? {}
        : {
          body: JSON.stringify({
            bodyRegion: input.bodyRegion,
            muscleName: input.muscleName,
            conditionName: 'Dolor muscular',
            description: observation.notes,
            painIntensity: observation.painIntensity,
            swelling: observation.swelling,
            functionalLimitation: observation.functionalLimitation,
          }),
        }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `No se pudo sincronizar el padecimiento (${response.status}).`
      );
      return { synced: false };
    }
    return { synced: true };
  } catch (error) {
    console.warn('No se pudo sincronizar el padecimiento con el backend.', error);
    return { synced: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getBodyConditionsFromBackend(): Promise<BodyConditionRecord[]> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!API_CONFIG.apiBaseUrl || authHeadersList.length === 0) {
    console.warn(
      'No se pudieron cargar los padecimientos: falta configurar EXPO_PUBLIC_API_BASE_URL y EXPO_PUBLIC_DASHBOARD_API_TOKEN.'
    );
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  try {
    const baseUrl = new URL(API_CONFIG.apiBaseUrl);
    if (
      baseUrl.protocol !== 'https:' &&
      !(__DEV__ && baseUrl.protocol === 'http:')
    ) {
      throw new Error('El backend debe usar HTTPS fuera del modo de desarrollo.');
    }

    const url = new URL('/dashboard/body-conditions', baseUrl);
    url.searchParams.set('limit', '500');

    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      if (response.status !== 401) break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      throw new Error(
        status === 401
          ? 'El backend rechazó el token al cargar los padecimientos (401).'
          : `No se pudieron cargar los padecimientos (${status}).`
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error('El backend devolvió registros anatómicos con formato inválido.');
    }
    const normalized = body
      .map(normalizeBodyConditionRecord)
      .filter((item): item is BodyConditionRecord => item !== null);
    if (body.length > 0 && normalized.length === 0) {
      throw new Error('El backend devolvió registros anatómicos con formato inválido.');
    }
    return normalized;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getDailyHealthChecksFromBackend(): Promise<DailyHealthCheck[]> {
  if (!API_CONFIG.apiBaseUrl || !API_CONFIG.dashboardApiToken) {
    console.warn(
      'No se pudieron cargar los cuestionarios: falta configurar EXPO_PUBLIC_API_BASE_URL y EXPO_PUBLIC_DASHBOARD_API_TOKEN.'
    );
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  try {
    const baseUrl = new URL(API_CONFIG.apiBaseUrl);
    if (
      baseUrl.protocol !== 'https:' &&
      !(__DEV__ && baseUrl.protocol === 'http:')
    ) {
      throw new Error('El backend debe usar HTTPS fuera del modo de desarrollo.');
    }

    const url = new URL('/dashboard/health-checks', baseUrl);
    url.searchParams.set('limit', '500');
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'El backend rechazó el token al cargar los cuestionarios (401).'
          : `No se pudieron cargar los cuestionarios (${response.status}).`
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isDailyHealthCheckRecord)) {
      throw new Error('El backend devolvió cuestionarios con formato inválido.');
    }

    return body.map((record) => ({
      ...record,
      notes: record.notes ?? '',
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// Endpoint listo para guardar cuestionario médico diario en el backend
export async function syncHealthCheckToBackend(
  check: DailyHealthCheck
): Promise<{ synced: boolean }> {
  if (!API_CONFIG.apiBaseUrl || !API_CONFIG.dashboardApiToken) {
    console.warn(
      'No se pudo sincronizar el cuestionario: falta configurar el backend.'
    );
    return { synced: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    const baseUrl = new URL(API_CONFIG.apiBaseUrl);
    if (
      baseUrl.protocol !== 'https:' &&
      !(__DEV__ && baseUrl.protocol === 'http:')
    ) {
      throw new Error('El backend debe usar HTTPS fuera del modo de desarrollo.');
    }

    const url = new URL(
      `/dashboard/health-checks/${check.dateIso}`,
      baseUrl
    );
    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bloodSugarMgDl: check.bloodSugarMgDl,
        systolicBp: check.systolicBp,
        diastolicBp: check.diastolicBp,
        temperatureC: check.temperatureC,
        sleepHours: check.sleepHours,
        mood: check.mood,
        symptoms: check.symptoms,
        notes: check.notes,
        overallStatus: check.overallStatus,
        recommendation: check.recommendation,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(
        `No se pudo sincronizar el cuestionario diario (${response.status}).`
      );
      return { synced: false };
    }
    return { synced: true };
  } catch (error) {
    console.warn(
      'No se pudo sincronizar el cuestionario diario con el backend.',
      error
    );
    return { synced: false };
  } finally {
    clearTimeout(timeout);
  }
}

