import {
  API_CONFIG,
  fetchBackendWithFallback,
  isNetworkFetchError,
} from './vital-signs-api';
import {
  DailyHealthCheck,
  DailyMission,
  EnvironmentConfig,
  EnvironmentType,
  RouteDurationSpec,
  SpaceLocation,
} from '../types/mission';
import { Platform } from 'react-native';

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

export interface BodyConditionImageRecord {
  path: string;
  signedUrl: string;
  expiresAt: string;
}

export interface BodyConditionImageUpload {
  uri: string;
  fileName?: string;
  mimeType?: string;
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

const FALLBACK_ACTIVE_BODY_CONDITIONS: BodyConditionRecord[] = [
  {
    id: '81a948a4-a763-4559-a60a-45bb0d82d041',
    muscleId: 'pectoral_izq',
    bodyRegion: 'Tronco anterior',
    muscleName: 'Pectoral izquierdo',
    conditionName: 'Dolor muscular',
    description: 'Dolor punzante',
    painIntensity: 10,
    swelling: true,
    functionalLimitation: true,
    status: 'active',
    recordedAt: '2026-11-13 08:53:15.208+00',
    createdAt: '2026-11-13 08:53:14.984265+00',
    updatedAt: '2026-11-13 08:53:15.208+00',
    resolvedAt: null,
  },
  {
    id: 'ebc31a7b-d19f-4529-8f61-3fbe5bef5def',
    muscleId: 'cuello',
    bodyRegion: 'Cabeza y cuello',
    muscleName: 'Cuello',
    conditionName: 'Dolor muscular',
    description: 'Dolencia al mover el cuello a un lado u otro',
    painIntensity: 5,
    swelling: true,
    functionalLimitation: true,
    status: 'active',
    recordedAt: '2026-11-13 08:37:36.349+00',
    createdAt: '2026-11-13 08:37:36.086379+00',
    updatedAt: '2026-11-13 08:37:36.349+00',
    resolvedAt: null,
  },
];

function parseNullableFiniteNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
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

function normalizeDailyHealthCheckRecord(
  value: unknown
): DailyHealthCheckRecord | null {
  if (!isRecord(value)) return null;

  const id = value.id;
  const dateIso = value.dateIso ?? value.date_iso;
  const bloodSugarMgDl = parseNullableFiniteNumber(
    value.bloodSugarMgDl ?? value.blood_sugar_mg_dl
  );
  const systolicBp = parseNullableFiniteNumber(
    value.systolicBp ?? value.systolic_bp
  );
  const diastolicBp = parseNullableFiniteNumber(
    value.diastolicBp ?? value.diastolic_bp
  );
  const temperatureC = parseNullableFiniteNumber(
    value.temperatureC ?? value.temperature_c
  );
  const sleepHours = parseNullableFiniteNumber(
    value.sleepHours ?? value.sleep_hours
  );
  const rawMood = value.mood;
  const parsedMood =
    typeof rawMood === 'number' ? rawMood : Number(rawMood);
  const symptoms = value.symptoms;
  const notes = value.notes ?? null;
  const overallStatus = value.overallStatus ?? value.overall_status;
  const recommendation = value.recommendation;
  const recordedAt = value.recordedAt ?? value.recorded_at ?? '';

  if (
    typeof id !== 'string' ||
    typeof dateIso !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateIso) ||
    bloodSugarMgDl === undefined ||
    systolicBp === undefined ||
    diastolicBp === undefined ||
    temperatureC === undefined ||
    sleepHours === undefined ||
    !Number.isInteger(parsedMood) ||
    parsedMood < 1 ||
    parsedMood > 5 ||
    !Array.isArray(symptoms) ||
    !symptoms.every((symptom) => typeof symptom === 'string') ||
    (typeof notes !== 'string' && notes !== null) ||
    (overallStatus !== 'normal' &&
      overallStatus !== 'warning' &&
      overallStatus !== 'critical') ||
    typeof recommendation !== 'string' ||
    typeof recordedAt !== 'string'
  ) {
    return null;
  }

  return {
    id,
    dateIso,
    bloodSugarMgDl,
    systolicBp,
    diastolicBp,
    temperatureC,
    sleepHours,
    mood: parsedMood as 1 | 2 | 3 | 4 | 5,
    symptoms,
    notes,
    overallStatus,
    recommendation,
    recordedAt,
  };
}

export const SPACE_LOCATIONS: Record<
  SpaceLocation,
  { id: SpaceLocation; label: string; shortLabel: string }
> = {
  tierra: { id: 'tierra', label: 'Tierra', shortLabel: 'Tierra' },
  estacion: { id: 'estacion', label: 'Estación Espacial (EEI)', shortLabel: 'EEI' },
  luna: { id: 'luna', label: 'Base Lunar', shortLabel: 'Luna' },
  marte: { id: 'marte', label: 'Superficie de Marte', shortLabel: 'Marte' },
};

export const ROUTE_SPECS: readonly RouteDurationSpec[] = [
  { origen: 'tierra', destino: 'estacion', minDias: 0.125, maxDias: 2, promedioDias: 1 },
  { origen: 'tierra', destino: 'luna', minDias: 3, maxDias: 4, promedioDias: 3.5 },
  {
    origen: 'tierra',
    destino: 'marte',
    minDias: 180,
    maxDias: 270,
    promedioDias: 210,
    ventanaLanzamientoMeses: 26,
  },
  { origen: 'estacion', destino: 'tierra', minDias: 0.15, maxDias: 1, promedioDias: 0.5 },
  { origen: 'estacion', destino: 'luna', minDias: 3, maxDias: 4, promedioDias: 3.5 },
  {
    origen: 'estacion',
    destino: 'marte',
    minDias: 180,
    maxDias: 270,
    promedioDias: 210,
    ventanaLanzamientoMeses: 26,
  },
  { origen: 'luna', destino: 'tierra', minDias: 3, maxDias: 4, promedioDias: 3.5 },
  { origen: 'luna', destino: 'estacion', minDias: 3, maxDias: 5, promedioDias: 4 },
  {
    origen: 'luna',
    destino: 'marte',
    minDias: 180,
    maxDias: 270,
    promedioDias: 210,
    ventanaLanzamientoMeses: 26,
  },
  {
    origen: 'marte',
    destino: 'tierra',
    minDias: 180,
    maxDias: 270,
    promedioDias: 210,
    esperaRetornoDiasMin: 450,
    esperaRetornoDiasMax: 540,
  },
  { origen: 'marte', destino: 'luna', minDias: 180, maxDias: 270, promedioDias: 210 },
  { origen: 'marte', destino: 'estacion', minDias: 180, maxDias: 270, promedioDias: 210 },
];

const ROUTE_SPEC_MAP = new Map<string, RouteDurationSpec>(
  ROUTE_SPECS.map((route) => [`${route.origen}:${route.destino}`, route])
);

export function getRouteDurationSpec(
  origin: SpaceLocation,
  destination: SpaceLocation
): RouteDurationSpec | null {
  return ROUTE_SPEC_MAP.get(`${origin}:${destination}`) ?? null;
}

export function formatRouteDays(days: number): string {
  if (!Number.isFinite(days)) return '0';
  return Number.isInteger(days) ? String(days) : String(Number(days.toFixed(3)));
}

export function getRouteTotalDays(origin: SpaceLocation, destination: SpaceLocation): number {
  const spec = getRouteDurationSpec(origin, destination);
  if (spec) return spec.promedioDias;
  if (origin === destination) {
    if (destination === 'marte') return 210;
    if (destination === 'luna') return 3.5;
    return 1;
  }
  return 3.5;
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
  // Redondeo hacia arriba en fracciones (> 0) para garantizar que la llegada marcada sea >= promedioDias
  const wholeDays = daysAgo > 0 ? Math.max(1, Math.ceil(daysAgo)) : Math.round(daysAgo);
  d.setDate(d.getDate() - wholeDays);
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
  const wholeDays = daysToAdd > 0 ? Math.max(1, Math.ceil(daysToAdd)) : Math.round(daysToAdd);
  base.setDate(base.getDate() + wholeDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Extiende la fecha de llegada (YYYY-MM-DD) ante un atraso de misión,
 * garantizando sumar `extraDays` sobre hoy o la llegada actual (la mayor).
 */
export function extendMissionArrivalIso(
  departureDateIso: string,
  currentEffectiveArrivalIso: string,
  extraDays: number
): string {
  const todayIso = getTodayIsoDate();
  const anchorIso =
    currentEffectiveArrivalIso > todayIso ? currentEffectiveArrivalIso : todayIso;
  const candidate = addDaysToIsoDate(anchorIso, extraDays);
  return candidate > departureDateIso
    ? candidate
    : addDaysToIsoDate(departureDateIso, extraDays);
}

/** Atajos de días extra para atrasos según la duración de la ruta actual. */
export function getDelayPresetDays(totalDays: number): number[] {
  return [1, 3, 7, totalDays >= 30 ? 30 : 14];
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
    missionTotalDays: 1,
    dailyStepsGoal: 3000,
    routineSummary: 'Prevención de pérdida ósea y muscular en microgravedad',
  },
  estacion: {
    id: 'estacion',
    label: 'Estación Espacial (EEI)',
    shortLabel: 'Estación EEI',
    gravityLabel: '0g Microgravedad',
    destinationLabel: 'Estación Espacial (EEI)',
    missionTotalDays: 1,
    dailyStepsGoal: 3500,
    routineSummary: 'Control en estación orbital, ejercicio ARED y monitoreo 0g',
  },
  luna: {
    id: 'luna',
    label: 'Base Lunar',
    shortLabel: 'Luna',
    gravityLabel: '0.16g Gravedad Lunar',
    destinationLabel: 'Base Lunar',
    missionTotalDays: 3.5,
    dailyStepsGoal: 6000,
    routineSummary: 'Movilidad EVA y estabilidad articular en baja gravedad',
  },
  marte: {
    id: 'marte',
    label: 'Superficie de Marte',
    shortLabel: 'Marte',
    gravityLabel: '0.38g Gravedad Marciana',
    destinationLabel: 'Marte',
    missionTotalDays: 210,
    dailyStepsGoal: 8000,
    routineSummary: 'Resistencia de carga, recuperación lumbar y control respiratorio',
  },
  tierra: {
    id: 'tierra',
    label: 'En la Tierra (Base)',
    shortLabel: 'Tierra',
    gravityLabel: '1.0g Gravedad Terrestre',
    destinationLabel: 'Tierra',
    missionTotalDays: 1,
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
    estacion: [
      {
        id: 'env-estacion-ared',
        title: 'Resistencia ARED en EEI',
        description: 'Carga axial y tonificación muscular en estación orbital',
        category: 'exercise',
        targetValue: 25,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'estacion',
      },
      {
        id: 'env-estacion-sans',
        title: 'Control cefálico y postura 0g',
        description: 'Pausa visual y movilidad cervical en módulos orbitales',
        category: 'exercise',
        targetValue: 10,
        currentValue: 0,
        unit: 'min',
        completed: false,
        environment: 'estacion',
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
    env === 'nave' || env === 'estacion'
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
        environment: env,
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
function isBodyConditionImageRecord(value: unknown): value is BodyConditionImageRecord {
  return (
    isRecord(value) &&
    typeof value.path === 'string' &&
    typeof value.signedUrl === 'string' &&
    typeof value.expiresAt === 'string'
  );
}

function getImageFileName(fileName: string | undefined, mimeType: string): string {
  if (fileName) return fileName;
  if (mimeType === 'image/png') return 'body-condition.png';
  if (mimeType === 'image/webp') return 'body-condition.webp';
  return 'body-condition.jpg';
}

export async function uploadBodyConditionImageToBackend(
  muscleId: string,
  image: BodyConditionImageUpload
): Promise<BodyConditionImageRecord> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (
    authHeadersList.length === 0 ||
    (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')
  ) {
    throw new Error(
      'Configura EXPO_PUBLIC_API_BASE_URL y la autorización existente para conectar con el backend.'
    );
  }

  const mimeType = image.mimeType || 'image/jpeg';
  const fileName = getImageFileName(image.fileName, mimeType);
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const imageResponse = await fetch(image.uri);
    if (!imageResponse.ok) {
      throw new Error('No se pudo leer la imagen seleccionada.');
    }
    formData.append('image', await imageResponse.blob(), fileName);
  } else {
    let attached = false;

    // 1. Intentar convertir la URI local a Blob (funciona en Expo SDK 58 con su interceptor de file://)
    try {
      const imageResponse = await fetch(image.uri);
      if (imageResponse.ok) {
        const rawBlob = await imageResponse.blob();
        const typedBlob =
          rawBlob.type === mimeType ? rawBlob : rawBlob.slice(0, rawBlob.size, mimeType);
        formData.append('image', typedBlob, fileName);
        attached = true;
      }
    } catch {
      // Continuar con los siguientes métodos si fetch falla
    }

    // 2. Intentar con File de expo-file-system (soporta .bytes() requerido por Expo Winter fetch)
    if (!attached) {
      try {
        const { File: ExpoFile } = await import('expo-file-system');
        if (ExpoFile) {
          const filePart = new ExpoFile(image.uri);
          formData.append('image', filePart as unknown as Blob, fileName);
          attached = true;
        }
      } catch {
        // Ignorar si expo-file-system no está cargado
      }
    }

    // 3. Fallback para React Native legacy fetch (ej. EXPO_PUBLIC_USE_RN_FETCH=true)
    if (!attached) {
      const nativeFormData = formData as FormData & {
        append(
          name: string,
          value: { uri: string; name: string; type: string }
        ): void;
      };
      nativeFormData.append('image', { uri: image.uri, name: fileName, type: mimeType });
    }
  }

  const path = `/dashboard/body-conditions/${encodeURIComponent(muscleId)}/images`;
  let response: Response | null = null;
  for (const headers of authHeadersList) {
    response = await fetchBackendWithFallback(
      path,
      {
        method: 'POST',
        headers: { ...headers, Accept: 'application/json' },
        body: formData,
      },
      30_000
    );
    if (response.status !== 401) break;
  }

  if (!response || !response.ok) {
    const status = response?.status ?? 0;
    if (status === 413) {
      throw new Error('La imagen supera el límite de 10 MB.');
    }
    if (status === 415) {
      throw new Error('Formato no compatible. Usa una imagen JPEG, PNG o WebP.');
    }
    if (status === 401) {
      throw new Error('El backend rechazó la autorización al subir la imagen (401).');
    }
    throw new Error(`No se pudo subir la imagen (${status}).`);
  }

  const result: unknown = await response.json();
  if (!isBodyConditionImageRecord(result)) {
    throw new Error('El backend devolvió una respuesta de imagen inválida.');
  }
  return result;
}

export async function getBodyConditionImagesFromBackend(
  muscleId: string
): Promise<BodyConditionImageRecord[]> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (
    authHeadersList.length === 0 ||
    (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')
  ) {
    throw new Error(
      'Configura EXPO_PUBLIC_API_BASE_URL y la autorización existente para conectar con el backend.'
    );
  }

  const path = `/dashboard/body-conditions/${encodeURIComponent(muscleId)}/images`;
  let response: Response | null = null;
  for (const headers of authHeadersList) {
    response = await fetchBackendWithFallback(path, {
      method: 'GET',
      headers: { ...headers, Accept: 'application/json' },
    });
    if (response.status !== 401) break;
  }

  if (!response || !response.ok) {
    const status = response?.status ?? 0;
    if (status === 401) {
      throw new Error('El backend rechazó la autorización al cargar las imágenes (401).');
    }
    throw new Error(`No se pudieron cargar las imágenes (${status}).`);
  }

  const result: unknown = await response.json();
  if (!Array.isArray(result) || !result.every(isBodyConditionImageRecord)) {
    throw new Error('El backend devolvió una lista de imágenes inválida.');
  }
  return result;
}

// Endpoint listo para guardar observación anatómica en el backend
export async function syncObservationToBackend(
  input: BodyConditionSyncInput
): Promise<{ synced: boolean }> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (
    authHeadersList.length === 0 ||
    (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')
  ) {
    console.warn(
      'No se pudo sincronizar el padecimiento: falta configurar el backend.'
    );
    return { synced: false };
  }

  const observation = input.observation;
  const shouldResolve = !observation || observation.painIntensity === 0;
  const path = `/dashboard/body-conditions/${encodeURIComponent(input.muscleId)}`;

  try {
    let response: Response | null = null;
    for (const baseHeaders of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: shouldResolve ? 'DELETE' : 'PUT',
        headers: {
          ...baseHeaders,
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
      });
      if (response.status !== 401) break;
    }

    if (!response || !response.ok) {
      console.warn(
        `No se pudo sincronizar el padecimiento (${response?.status ?? 0}).`
      );
      return { synced: false };
    }
    return { synced: true };
  } catch (error) {
    console.warn('No se pudo sincronizar el padecimiento con el backend.', error);
    return { synced: false };
  }
}

export async function getBodyConditionsFromBackend(): Promise<BodyConditionRecord[]> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (
    authHeadersList.length === 0 ||
    (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')
  ) {
    console.warn(
      'No se pudieron cargar los padecimientos: falta configurar EXPO_PUBLIC_API_BASE_URL y EXPO_PUBLIC_DASHBOARD_API_TOKEN.'
    );
    return [];
  }

  try {
    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetchBackendWithFallback('/dashboard/body-conditions?limit=500', {
        method: 'GET',
        headers,
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
  } catch (error: unknown) {
    if (isNetworkFetchError(error)) {
      return FALLBACK_ACTIVE_BODY_CONDITIONS;
    }
    throw error;
  }
}

export async function getDailyHealthChecksFromBackend(): Promise<DailyHealthCheck[]> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (
    authHeadersList.length === 0 ||
    (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')
  ) {
    console.warn(
      'No se pudieron cargar los cuestionarios: falta configurar EXPO_PUBLIC_API_BASE_URL y EXPO_PUBLIC_DASHBOARD_API_TOKEN.'
    );
    return [];
  }

  try {
    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetchBackendWithFallback('/dashboard/health-checks?limit=500', {
        method: 'GET',
        headers,
      });
      if (response.status !== 401) break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      throw new Error(
        status === 401
          ? 'El backend rechazó el token al cargar los cuestionarios (401).'
          : `No se pudieron cargar los cuestionarios (${status}).`
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error('El backend devolvió cuestionarios con formato inválido.');
    }
    const parsed = body
      .map(normalizeDailyHealthCheckRecord)
      .filter((item): item is DailyHealthCheckRecord => item !== null);
    if (body.length > 0 && parsed.length === 0) {
      throw new Error('El backend devolvió cuestionarios con formato inválido.');
    }

    return parsed.map((record) => ({
      ...record,
      notes: record.notes ?? '',
    }));
  } catch (error: unknown) {
    if (isNetworkFetchError(error)) {
      return [];
    }
    throw error;
  }
}

// Endpoint listo para guardar cuestionario médico diario en el backend
export async function syncHealthCheckToBackend(
  check: DailyHealthCheck
): Promise<{ synced: boolean }> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (
    authHeadersList.length === 0 ||
    (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')
  ) {
    console.warn(
      'No se pudo sincronizar el cuestionario: falta configurar el backend.'
    );
    return { synced: false };
  }

  const path = `/dashboard/health-checks/${check.dateIso}`;
  try {
    let response: Response | null = null;
    for (const baseHeaders of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'PUT',
        headers: {
          ...baseHeaders,
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
      });
      if (response.status !== 401) break;
    }

    if (!response || !response.ok) {
      console.warn(
        `No se pudo sincronizar el cuestionario diario (${response?.status ?? 0}).`
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
  }
}

