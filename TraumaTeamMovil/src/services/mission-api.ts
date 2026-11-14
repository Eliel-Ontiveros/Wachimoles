import {
  API_CONFIG,
  fetchBackendWithFallback,
  isNetworkFetchError,
} from './vital-signs-api';
import {
  AstronautMissionStateRecord,
  DailyHealthCheck,
  DailyMission,
  EnvironmentConfig,
  EnvironmentType,
  MissionExecutionStatus,
  RouteDurationSpec,
  SpaceLocation,
} from '../types/mission';
import { Platform } from 'react-native';
import { MESSAGES, translate, type Locale, type MessageKey } from '../i18n/messages';

// Servicio preparado para conectar misiones, entorno y fotos de lesiones con el backend

export interface BodyConditionSyncInput {
  muscleId: string;
  bodyRegion: string;
  muscleName: string;
  conditionName?: string;
  resolveAfterSave?: boolean;
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
    value.conditionName ?? value.condition_name ?? 'Muscle pain';
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
    bodyRegion: 'Front torso',
    muscleName: 'Left pectoral',
    conditionName: 'Muscle pain',
    description: 'Sharp pain',
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
    bodyRegion: 'Head and neck',
    muscleName: 'Neck',
    conditionName: 'Muscle pain',
    description: 'Discomfort when moving the neck from side to side',
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
  tierra: { id: 'tierra', label: 'Earth', shortLabel: 'Earth' },
  estacion: { id: 'estacion', label: 'Space Station (ISS)', shortLabel: 'ISS' },
  luna: { id: 'luna', label: 'Lunar Base', shortLabel: 'Moon' },
  marte: { id: 'marte', label: 'Martian Surface', shortLabel: 'Mars' },
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
    label: 'On the Ship (Orbit)',
    shortLabel: 'Ship',
    gravityLabel: '0g Microgravity',
    destinationLabel: 'Orbital Station',
    missionTotalDays: 1,
    dailyStepsGoal: 3000,
    routineSummary: 'Preventing bone and muscle loss in microgravity',
  },
  estacion: {
    id: 'estacion',
    label: 'Space Station (ISS)',
    shortLabel: 'ISS Station',
    gravityLabel: '0g Microgravity',
    destinationLabel: 'Space Station (ISS)',
    missionTotalDays: 1,
    dailyStepsGoal: 3500,
    routineSummary: 'Orbital station care, ARED exercise and 0g monitoring',
  },
  luna: {
    id: 'luna',
    label: 'Lunar Base',
    shortLabel: 'Moon',
    gravityLabel: '0.16g Lunar Gravity',
    destinationLabel: 'Lunar Base',
    missionTotalDays: 3.5,
    dailyStepsGoal: 6000,
    routineSummary: 'EVA mobility and joint stability in low gravity',
  },
  marte: {
    id: 'marte',
    label: 'Martian Surface',
    shortLabel: 'Mars',
    gravityLabel: '0.38g Martian Gravity',
    destinationLabel: 'Mars',
    missionTotalDays: 210,
    dailyStepsGoal: 8000,
    routineSummary: 'Load endurance, lower-back recovery and breathing control',
  },
  tierra: {
    id: 'tierra',
    label: 'On Earth (Base)',
    shortLabel: 'Earth',
    gravityLabel: '1.0g Earth Gravity',
    destinationLabel: 'Earth',
    missionTotalDays: 1,
    dailyStepsGoal: 8000,
    routineSummary: 'Pre-mission conditioning and 1g cardiovascular readaptation',
  },
};

/** Textos visibles de un entorno (los `label` de ENVIRONMENTS son el respaldo). */
export function getEnvironmentText(locale: Locale, id: EnvironmentType) {
  const tr = (field: string) => translate(locale, `missions.env.${id}.${field}` as MessageKey);
  return {
    label: tr('label'),
    shortLabel: tr('short'),
    gravityLabel: tr('gravity'),
    destinationLabel: tr('dest'),
    routineSummary: tr('routine'),
  };
}

/** Nombres visibles de una ubicación espacial. */
export function getLocationText(locale: Locale, id: SpaceLocation) {
  return {
    label: translate(locale, `missions.loc.${id}.label` as MessageKey),
    shortLabel: translate(locale, `missions.loc.${id}.short` as MessageKey),
  };
}

export function getMissionsForEnvironment(
  env: EnvironmentType,
  currentSteps: number,
  checkedInToday: boolean,
  treadmillActive = false,
  locale: Locale = 'en'
): DailyMission[] {
  const goal = ENVIRONMENTS[env].dailyStepsGoal;
  const tx = (key: string, params?: Record<string, string | number>) =>
    translate(locale, `missions.mission.${key}` as MessageKey, params);
  const unit = (u: 'min' | 'pasos' | 'check') =>
    translate(locale, `missions.unit.${u}` as MessageKey);

  const envRoutines: Record<EnvironmentType, DailyMission[]> = {
    tierra: [
      {
        id: 'env-tierra-cardio',
        title: tx('env-tierra-cardio.title'),
        description: tx('env-tierra-cardio.desc'),
        category: 'exercise',
        targetValue: 30,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'tierra',
      },
      {
        id: 'env-tierra-core',
        title: tx('env-tierra-core.title'),
        description: tx('env-tierra-core.desc'),
        category: 'exercise',
        targetValue: 15,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'tierra',
      },
    ],
    nave: [
      {
        id: 'env-nave-ared',
        title: tx('env-nave-ared.title'),
        description: tx('env-nave-ared.desc'),
        category: 'exercise',
        targetValue: 25,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'nave',
      },
      {
        id: 'env-nave-stretch',
        title: tx('env-nave-stretch.title'),
        description: tx('env-nave-stretch.desc'),
        category: 'exercise',
        targetValue: 10,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'nave',
      },
    ],
    estacion: [
      {
        id: 'env-estacion-ared',
        title: tx('env-estacion-ared.title'),
        description: tx('env-estacion-ared.desc'),
        category: 'exercise',
        targetValue: 25,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'estacion',
      },
      {
        id: 'env-estacion-sans',
        title: tx('env-estacion-sans.title'),
        description: tx('env-estacion-sans.desc'),
        category: 'exercise',
        targetValue: 10,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'estacion',
      },
    ],
    luna: [
      {
        id: 'env-luna-eva',
        title: tx('env-luna-eva.title'),
        description: tx('env-luna-eva.desc'),
        category: 'exercise',
        targetValue: 20,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'luna',
      },
      {
        id: 'env-luna-balance',
        title: tx('env-luna-balance.title'),
        description: tx('env-luna-balance.desc'),
        category: 'exercise',
        targetValue: 15,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'luna',
      },
    ],
    marte: [
      {
        id: 'env-marte-load',
        title: tx('env-marte-load.title'),
        description: tx('env-marte-load.desc'),
        category: 'exercise',
        targetValue: 30,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'marte',
      },
      {
        id: 'env-marte-resp',
        title: tx('env-marte-resp.title'),
        description: tx('env-marte-resp.desc'),
        category: 'exercise',
        targetValue: 10,
        currentValue: 0,
        unit: unit('min'),
        completed: false,
        environment: 'marte',
      },
    ],
  };

  const activityMission: DailyMission =
    env === 'nave' || env === 'estacion'
      ? {
        id: 'treadmill-steps',
        title: tx(treadmillActive ? 'treadmill-on.title' : 'treadmill-off.title'),
        description: tx(treadmillActive ? 'treadmill-on.desc' : 'treadmill-off.desc'),
        category: 'treadmill',
        targetValue: goal,
        currentValue: treadmillActive ? currentSteps : 0,
        unit: unit('pasos'),
        completed: treadmillActive && currentSteps >= goal,
        environment: env,
      }
      : {
        id: 'daily-steps',
        title: tx('daily-steps.title', { place: getEnvironmentText(locale, env).shortLabel }),
        description: tx('daily-steps.desc'),
        category: 'steps',
        targetValue: goal,
        currentValue: currentSteps,
        unit: unit('pasos'),
        completed: currentSteps >= goal,
        environment: env,
      };

  return [
    {
      id: 'daily-checkin',
      title: tx('daily-checkin.title'),
      description: tx('daily-checkin.desc'),
      category: 'checkin',
      targetValue: 1,
      currentValue: checkedInToday ? 1 : 0,
      unit: unit('check'),
      completed: checkedInToday,
      environment: 'all',
    },
    activityMission,
    ...envRoutines[env],
  ];
}

/**
 * Re-traduce al idioma activo una misión recibida del backend cuando su id es una de las
 * misiones conocidas de la app; los ids desconocidos conservan el texto del backend.
 */
export function localizeMission(
  m: DailyMission,
  locale: Locale,
  env: EnvironmentType,
  treadmillActive: boolean
): DailyMission {
  const has = (key: string) => key in MESSAGES.en;
  const baseId =
    m.id === 'treadmill-steps' ? (treadmillActive ? 'treadmill-on' : 'treadmill-off') : m.id;
  const titleKey = `missions.mission.${baseId}.title`;
  const descKey = `missions.mission.${baseId}.desc`;
  const unitKey = `missions.unit.${m.unit}`;
  return {
    ...m,
    title: has(titleKey)
      ? translate(locale, titleKey as MessageKey, {
          place: getEnvironmentText(locale, env).shortLabel,
        })
      : m.title,
    description: has(descKey) ? translate(locale, descKey as MessageKey) : m.description,
    unit: has(unitKey) ? translate(locale, unitKey as MessageKey) : m.unit,
  };
}

// Endpoint para consultar misiones rotadas y aleatorias con dificultad desde el backend
export async function fetchDailyMissionsFromBackend(
  env: EnvironmentType,
  currentSteps = 0,
  checkedInToday = false,
  treadmillActive = false,
  dateIso?: string,
  locale: Locale = 'en'
): Promise<DailyMission[]> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!canUseBackend(authHeadersList)) {
    return getMissionsForEnvironment(env, currentSteps, checkedInToday, treadmillActive, locale);
  }

  const queryParams = new URLSearchParams({
    entorno: env,
    pasosActuales: String(currentSteps),
    checkinRealizado: String(checkedInToday),
    caminadoraActiva: String(treadmillActive),
  });
  if (dateIso) {
    queryParams.set('fecha', dateIso);
  }

  const path = `/dashboard/missions/daily?${queryParams.toString()}`;
  try {
    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
      });
      if (response.status !== 401) break;
    }

    if (!response || !response.ok) {
      return getMissionsForEnvironment(env, currentSteps, checkedInToday, treadmillActive, locale);
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) {
      return getMissionsForEnvironment(env, currentSteps, checkedInToday, treadmillActive, locale);
    }

    return data.map((item: any) => ({
      id: String(item.id),
      title: String(item.title || item.titulo || translate(locale, 'missions.mission.fallback.title')),
      description: String(item.description || item.descripcion || ''),
      category: item.category || item.categoria || 'exercise',
      targetValue: Number(item.targetValue ?? item.valorObjetivo ?? 1),
      currentValue: Number(item.currentValue ?? item.valorActual ?? 0),
      unit: String(item.unit || item.unidad || 'min'),
      completed: Boolean(item.completed ?? item.completada ?? false),
      environment: item.environment || item.entorno || env,
    }));
  } catch {
    return getMissionsForEnvironment(env, currentSteps, checkedInToday, treadmillActive, locale);
  }
}

export interface AstronautMissionStatePayload {
  origen: SpaceLocation;
  destino: SpaceLocation;
  fechaSalida: string;
  fechaLlegadaEstimada?: string | null;
  diasTotales: number;
  diaActual: number;
  porcentajeProgresoRelativo?: number;
  entornoActual: EnvironmentType;
  estado?: MissionExecutionStatus;
}

const VALID_SPACE_LOCATIONS: readonly SpaceLocation[] = [
  'tierra',
  'estacion',
  'luna',
  'marte',
];

const VALID_ENVIRONMENTS: readonly EnvironmentType[] = [
  'tierra',
  'nave',
  'estacion',
  'luna',
  'marte',
];

function isSpaceLocation(value: unknown): value is SpaceLocation {
  return typeof value === 'string' && VALID_SPACE_LOCATIONS.includes(value as SpaceLocation);
}

function isEnvironmentType(value: unknown): value is EnvironmentType {
  return typeof value === 'string' && VALID_ENVIRONMENTS.includes(value as EnvironmentType);
}

function canUseBackend(authHeadersList: Record<string, string>[]): boolean {
  return (
    authHeadersList.length > 0 &&
    (Boolean(API_CONFIG.apiBaseUrl) || typeof window !== 'undefined' || __DEV__)
  );
}

function normalizeAstronautMissionStateRecord(
  value: unknown
): AstronautMissionStateRecord | null {
  if (!isRecord(value)) return null;

  const id = typeof value.id === 'string' ? value.id : '';
  const usuarioId =
    typeof value.usuarioId === 'string'
      ? value.usuarioId
      : typeof value.userId === 'string'
        ? value.userId
        : '';
  const origen = value.origen ?? value.origin;
  const destino = value.destino ?? value.destination;
  const fechaSalida = value.fechaSalida ?? value.departureDate;
  const fechaLlegadaEstimada =
    value.fechaLlegadaEstimada ?? value.estimatedArrivalDate;
  const rawActualArrival = value.fechaLlegadaReal ?? value.actualArrivalDate ?? null;
  const diasTotales = Number(value.diasTotales ?? value.totalDays);
  const diaActual = Number(value.diaActual ?? value.currentDay);
  const porcentajeProgresoRelativo = Number(
    value.porcentajeProgresoRelativo ?? value.relativeProgressPct ?? 0
  );
  const entornoActual = value.entornoActual ?? value.currentEnvironment;
  const estado = value.estado ?? value.status;
  const llegadaAnticipada = Boolean(
    value.llegadaAnticipada ?? value.arrivedEarly ?? false
  );
  const actualizadoEn =
    typeof value.actualizadoEn === 'string'
      ? value.actualizadoEn
      : typeof value.updatedAt === 'string'
        ? value.updatedAt
        : undefined;

  if (
    !isSpaceLocation(origen) ||
    !isSpaceLocation(destino) ||
    typeof fechaSalida !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaSalida) ||
    typeof fechaLlegadaEstimada !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fechaLlegadaEstimada) ||
    (rawActualArrival !== null && typeof rawActualArrival !== 'string') ||
    !Number.isFinite(diasTotales) ||
    !Number.isFinite(diaActual) ||
    !Number.isFinite(porcentajeProgresoRelativo) ||
    !isEnvironmentType(entornoActual) ||
    (estado !== 'scheduled' && estado !== 'in_transit' && estado !== 'arrived')
  ) {
    return null;
  }

  return {
    id,
    usuarioId,
    origen,
    destino,
    fechaSalida,
    fechaLlegadaEstimada,
    fechaLlegadaReal: rawActualArrival,
    diasTotales,
    diaActual,
    porcentajeProgresoRelativo,
    entornoActual,
    estado,
    llegadaAnticipada,
    actualizadoEn,
  };
}

// Consulta el plan de vuelo y estado relativo de misión guardado en BD
export async function fetchAstronautMissionStateFromBackend(): Promise<AstronautMissionStateRecord | null> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!canUseBackend(authHeadersList)) {
    return null;
  }

  try {
    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetchBackendWithFallback('/dashboard/mission-state', {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
      });
      if (response.status !== 401) break;
    }

    if (!response || !response.ok) {
      if (response) {
        console.warn('[mission-api] Error querying mission-state:', response.status);
      }
      return null;
    }

    const rawText = await response.text();
    if (!rawText.trim()) {
      return null;
    }

    const parsed: unknown = JSON.parse(rawText);
    if (parsed === null) {
      return null;
    }
    return normalizeAstronautMissionStateRecord(parsed);
  } catch (err) {
    console.warn('[mission-api] Could not load the mission state from the backend:', err);
    return null;
  }
}

// Guarda la ubicación relativa del astronauta en el backend en perspectiva de los días de misión
export async function syncAstronautMissionStateToBackend(
  payload: AstronautMissionStatePayload
): Promise<boolean> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!canUseBackend(authHeadersList)) {
    return false;
  }

  const safeTotalDays = Math.max(0.1, Number(payload.diasTotales) || 1);
  const safeCurrentDay = Math.max(0, Number(payload.diaActual) || 0);
  const rawPct =
    payload.porcentajeProgresoRelativo !== undefined
      ? Number(payload.porcentajeProgresoRelativo)
      : (safeCurrentDay / safeTotalDays) * 100;
  const safePct = Math.max(0, Math.min(100, Math.round(rawPct * 100) / 100));

  const requestBody: Record<string, unknown> = {
    origen: payload.origen,
    destino: payload.destino,
    fechaSalida: payload.fechaSalida,
    diasTotales: safeTotalDays,
    diaActual: safeCurrentDay,
    porcentajeProgresoRelativo: safePct,
    entornoActual: payload.entornoActual,
  };
  if (
    typeof payload.fechaLlegadaEstimada === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(payload.fechaLlegadaEstimada)
  ) {
    requestBody.fechaLlegadaEstimada = payload.fechaLlegadaEstimada;
  }
  if (payload.estado) {
    requestBody.estado = payload.estado;
  }

  const path = '/dashboard/mission-state';
  try {
    let response: Response | null = null;
    for (const baseHeaders of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'PUT',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (response.status !== 401) break;
    }
    if (!response || !response.ok) {
      console.warn('[mission-api] Backend rejected the mission-state sync:', response?.status ?? 0);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[mission-api] Could not sync the mission location with the backend:', err);
    return false;
  }
}

// Endpoint para que el astronauta le pique al botón "Llegué antes" y se guarde en backend
export async function markEarlyArrivalInBackend(
  fechaLlegadaReal?: string
): Promise<boolean> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!canUseBackend(authHeadersList)) {
    return false;
  }

  const path = '/dashboard/mission-state/arrive-early';
  try {
    let response: Response | null = null;
    for (const baseHeaders of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fechaLlegadaReal: fechaLlegadaReal || getTodayIsoDate(),
        }),
      });
      if (response.status !== 401) break;
    }
    if (!response || !response.ok) {
      console.warn('[mission-api] Error registering early arrival:', response?.status ?? 0);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[mission-api] Could not register the early arrival on the backend:', err);
    return false;
  }
}

// Cancela el plan de vuelo activo en BD sin modificar endpoints del backend, liberando la ubicación actual
export async function cancelAstronautMissionInBackend(
  currentEnvironment: EnvironmentType,
  origin: SpaceLocation,
  destination: SpaceLocation
): Promise<boolean> {
  const todayIso = getTodayIsoDate();
  const missionUpdated = await syncAstronautMissionStateToBackend({
    origen: origin,
    destino: destination,
    fechaSalida: todayIso,
    fechaLlegadaEstimada: todayIso,
    diasTotales: 1,
    diaActual: 1,
    porcentajeProgresoRelativo: 100,
    entornoActual: currentEnvironment,
    estado: 'arrived',
  });
  const locationUpdated = await saveAstronautLocationToBackend(currentEnvironment);
  return missionUpdated && locationUpdated;
}

// Endpoint para guardar la ubicación actual del astronauta en el backend de forma independiente (con o sin misión)
export async function saveAstronautLocationToBackend(
  entorno: EnvironmentType
): Promise<boolean> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!canUseBackend(authHeadersList)) {
    return false;
  }

  const paths = [
    '/dashboard/astronaut/location',
    '/dashboard/mission-state/location',
    '/mission/environment',
  ];

  const payload: Record<string, string> = {
    entorno,
    environment: entorno,
  };
  if (API_CONFIG.userId) {
    payload.userId = API_CONFIG.userId;
  }

  for (const path of paths) {
    try {
      let response: Response | null = null;
      for (const baseHeaders of authHeadersList) {
        response = await fetchBackendWithFallback(path, {
          method: 'PUT',
          headers: {
            ...baseHeaders,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (response.status !== 401 && response.status !== 404) break;
      }
      if (response && response.ok) {
        return true;
      }
    } catch {
      // Intentar siguiente ruta de fallback si hay fallo de red específico
    }
  }
  console.warn('[mission-api] Could not save the current location on the backend:', entorno);
  return false;
}

// Endpoint para consultar la ubicación actual del astronauta desde el backend
export async function fetchAstronautLocationFromBackend(): Promise<{
  entorno: EnvironmentType;
  label: string;
  gravityLabel: string;
} | null> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (!canUseBackend(authHeadersList)) {
    return null;
  }

  const paths = ['/dashboard/astronaut/location', '/dashboard/mission-state/location'];
  for (const path of paths) {
    try {
      let response: Response | null = null;
      for (const headers of authHeadersList) {
        response = await fetchBackendWithFallback(path, {
          method: 'GET',
          headers: { ...headers, Accept: 'application/json' },
        });
        if (response.status !== 401 && response.status !== 404) break;
      }

      if (response && response.ok) {
        const rawText = await response.text();
        if (!rawText.trim()) continue;
        const data: unknown = JSON.parse(rawText);
        if (isRecord(data)) {
          const raw = String(data.entorno ?? data.environment ?? '').toLowerCase().trim();
          let entorno: EnvironmentType | null = null;
          if (raw === 'tierra' || raw === 'earth') entorno = 'tierra';
          else if (raw === 'nave' || raw === 'spaceship' || raw === 'ship') entorno = 'nave';
          else if (raw === 'estacion' || raw === 'station') entorno = 'estacion';
          else if (raw === 'luna' || raw === 'moon') entorno = 'luna';
          else if (raw === 'marte' || raw === 'mars') entorno = 'marte';

          if (entorno) {
            return {
              entorno,
              label: typeof data.etiqueta === 'string' ? data.etiqueta : (data.label as string) || entorno,
              gravityLabel:
                typeof data.gravedadEtiqueta === 'string'
                  ? data.gravedadEtiqueta
                  : (data.gravityLabel as string) || '',
            };
          }
        }
      }
    } catch {
      // Intentar siguiente ruta de fallback
    }
  }
  return null;
}

// Guarda el entorno seleccionado en el backend de forma inmediata
export async function syncEnvironmentToBackend(environment: EnvironmentType): Promise<boolean> {
  try {
    return await saveAstronautLocationToBackend(environment);
  } catch {
    return false;
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
      'Set EXPO_PUBLIC_API_BASE_URL and the existing authorization to connect to the backend.'
    );
  }

  const mimeType = image.mimeType || 'image/jpeg';
  const fileName = getImageFileName(image.fileName, mimeType);
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const imageResponse = await fetch(image.uri);
    if (!imageResponse.ok) {
      throw new Error('Could not read the selected image.');
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
      throw new Error('The image exceeds the 10 MB limit.');
    }
    if (status === 415) {
      throw new Error('Unsupported format. Use a JPEG, PNG or WebP image.');
    }
    if (status === 401) {
      throw new Error('The backend rejected the authorization while uploading the image (401).');
    }
    throw new Error(`Could not upload the image (${status}).`);
  }

  const result: unknown = await response.json();
  if (!isBodyConditionImageRecord(result)) {
    throw new Error('The backend returned an invalid image response.');
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
      'Set EXPO_PUBLIC_API_BASE_URL and the existing authorization to connect to the backend.'
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
      throw new Error('The backend rejected the authorization while loading the images (401).');
    }
    throw new Error(`Could not load the images (${status}).`);
  }

  const result: unknown = await response.json();
  if (!Array.isArray(result) || !result.every(isBodyConditionImageRecord)) {
    throw new Error('The backend returned an invalid image list.');
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
      'Could not sync the condition: the backend is not configured.'
    );
    return { synced: false };
  }

  const observation = input.observation;
  const resolveAfterSave = Boolean(
    input.resolveAfterSave || (observation && observation.painIntensity === 0)
  );
  const pureDelete = !observation;
  const path = `/dashboard/body-conditions/${encodeURIComponent(input.muscleId)}`;

  const sendWithAuth = async (
    method: 'PUT' | 'DELETE',
    bodyJson?: string
  ): Promise<Response | null> => {
    let response: Response | null = null;
    for (const baseHeaders of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method,
        headers: {
          ...baseHeaders,
          ...(bodyJson ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(bodyJson ? { body: bodyJson } : {}),
      });
      if (response.status !== 401) break;
    }
    return response;
  };

  try {
    if (!pureDelete && observation) {
      const clampedPain = Math.max(1, Math.min(10, Math.round(observation.painIntensity || 1)));
      const putResponse = await sendWithAuth(
        'PUT',
        JSON.stringify({
          bodyRegion: input.bodyRegion,
          muscleName: input.muscleName,
          conditionName: input.conditionName?.trim() || 'Muscle pain',
          description: observation.notes,
          painIntensity: clampedPain,
          swelling: observation.swelling,
          functionalLimitation: observation.functionalLimitation,
        })
      );

      if (!putResponse || !putResponse.ok) {
        console.warn(
          `Could not sync the condition (${putResponse?.status ?? 0}).`
        );
        return { synced: false };
      }

      if (!resolveAfterSave) {
        return { synced: true };
      }
    }

    const deleteResponse = await sendWithAuth('DELETE');
    if (!deleteResponse || !deleteResponse.ok) {
      console.warn(
        `Could not mark the condition as resolved (${deleteResponse?.status ?? 0}).`
      );
      return { synced: false };
    }

    return { synced: true };
  } catch (error) {
    console.warn('Could not sync the condition with the backend.', error);
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
      'Could not load the conditions: EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_DASHBOARD_API_TOKEN are not configured.'
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
          ? 'The backend rejected the token while loading the conditions (401).'
          : `Could not load the conditions (${status}).`
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error('The backend returned anatomical records with an invalid format.');
    }
    const normalized = body
      .map(normalizeBodyConditionRecord)
      .filter((item): item is BodyConditionRecord => item !== null);
    if (body.length > 0 && normalized.length === 0) {
      throw new Error('The backend returned anatomical records with an invalid format.');
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
      'Could not load the questionnaires: EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_DASHBOARD_API_TOKEN are not configured.'
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
          ? 'The backend rejected the token while loading the questionnaires (401).'
          : `Could not load the questionnaires (${status}).`
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new Error('The backend returned questionnaires with an invalid format.');
    }
    const parsed = body
      .map(normalizeDailyHealthCheckRecord)
      .filter((item): item is DailyHealthCheckRecord => item !== null);
    if (body.length > 0 && parsed.length === 0) {
      throw new Error('The backend returned questionnaires with an invalid format.');
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
      'Could not sync the questionnaire: the backend is not configured.'
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
        `Could not sync the daily questionnaire (${response?.status ?? 0}).`
      );
      return { synced: false };
    }
    return { synced: true };
  } catch (error) {
    console.warn(
      'Could not sync the daily questionnaire with the backend.',
      error
    );
    return { synced: false };
  }
}

export interface AstronautStreak {
  rachaActual: number;
  rachaMaxima: number;
  totalDiasCompletados: number;
  ultimaFechaCompletada: string | null;
  todasCompletadasHoy: boolean;
}

export interface DailyMissionProgressResponse {
  fecha: string;
  totalMisiones: number;
  misionesCompletadas: number;
  todasCompletadas: boolean;
  puntoRachaOtorgado: boolean;
  racha: AstronautStreak;
  misiones: Array<{
    misionId: string;
    completada: boolean;
    valorActual: number;
    valorObjetivo: number;
  }>;
}

// Consulta la racha acumulada del astronauta desde la base de datos
export async function fetchAstronautStreakFromBackend(): Promise<AstronautStreak | null> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (authHeadersList.length === 0 || (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')) {
    return null;
  }

  const path = '/dashboard/missions/streak';
  try {
    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
      });
      if (response.status !== 401) break;
    }

    if (response && response.ok) {
      const data: unknown = await response.json();
      if (isRecord(data)) {
        return {
          rachaActual: Number(data.rachaActual ?? data.currentStreak ?? 0),
          rachaMaxima: Number(data.rachaMaxima ?? data.maxStreak ?? 0),
          totalDiasCompletados: Number(data.totalDiasCompletados ?? data.totalCompletedDays ?? 0),
          ultimaFechaCompletada: (data.ultimaFechaCompletada as string) ?? (data.lastCompletedDate as string) ?? null,
          todasCompletadasHoy: Boolean(data.todasCompletadasHoy ?? data.allCompletedToday),
        };
      }
    }
  } catch {
    // Si no hay red, opera localmente
  }
  return null;
}

// Consulta el cumplimiento de misiones del día desde el backend
export async function fetchDailyMissionProgressFromBackend(
  fecha?: string
): Promise<{
  misiones: Record<string, boolean>;
  todasCompletadas: boolean;
  racha: AstronautStreak;
} | null> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (authHeadersList.length === 0 || (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')) {
    return null;
  }

  const queryFecha = fecha ? `?fecha=${encodeURIComponent(fecha)}` : '';
  const path = `/dashboard/missions/daily/progress${queryFecha}`;
  try {
    let response: Response | null = null;
    for (const headers of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
      });
      if (response.status !== 401) break;
    }

    if (response && response.ok) {
      const data: unknown = await response.json();
      if (isRecord(data)) {
        const misionesMap: Record<string, boolean> = {};
        if (Array.isArray(data.misiones)) {
          for (const m of data.misiones) {
            if (isRecord(m) && typeof m.misionId === 'string') {
              misionesMap[m.misionId] = Boolean(m.completada ?? m.completed);
            }
          }
        }
        const rachaRaw = isRecord(data.racha) ? data.racha : {};
        const racha: AstronautStreak = {
          rachaActual: Number(rachaRaw.rachaActual ?? rachaRaw.currentStreak ?? 0),
          rachaMaxima: Number(rachaRaw.rachaMaxima ?? rachaRaw.maxStreak ?? 0),
          totalDiasCompletados: Number(rachaRaw.totalDiasCompletados ?? rachaRaw.totalCompletedDays ?? 0),
          ultimaFechaCompletada: (rachaRaw.ultimaFechaCompletada as string) ?? null,
          todasCompletadasHoy: Boolean(rachaRaw.todasCompletadasHoy),
        };
        const resumen = isRecord(data.resumen) ? data.resumen : null;
        return {
          misiones: misionesMap,
          todasCompletadas: Boolean(resumen?.todasCompletadas ?? resumen?.allCompleted),
          racha,
        };
      }
    }
  } catch {
    // Si no hay red, continúa
  }
  return null;
}

// Sincroniza el cumplimiento de todas las misiones del día y actualiza la racha en la base de datos
export async function syncDailyMissionsProgressToBackend(
  misiones: DailyMission[],
  fecha?: string
): Promise<DailyMissionProgressResponse | null> {
  const authHeadersList = getMobileFallbackAuthHeaders();
  if (authHeadersList.length === 0 || (!API_CONFIG.apiBaseUrl && typeof window === 'undefined')) {
    return null;
  }

  const payload = {
    fecha: fecha || getTodayIsoDate(),
    misiones: misiones.map((m) => ({
      misionId: m.id,
      completada: m.completed,
      valorActual: m.currentValue,
      valorObjetivo: m.targetValue,
    })),
  };

  const path = '/dashboard/missions/daily/progress';
  try {
    let response: Response | null = null;
    for (const baseHeaders of authHeadersList) {
      response = await fetchBackendWithFallback(path, {
        method: 'PUT',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (response.status !== 401) break;
    }

    if (response && response.ok) {
      const data: unknown = await response.json();
      if (isRecord(data)) {
        const rachaRaw = isRecord(data.racha) ? data.racha : {};
        return {
          fecha: (data.fecha as string) || payload.fecha,
          totalMisiones: Number(data.totalMisiones || 0),
          misionesCompletadas: Number(data.misionesCompletadas || 0),
          todasCompletadas: Boolean(data.todasCompletadas),
          puntoRachaOtorgado: Boolean(data.puntoRachaOtorgado),
          racha: {
            rachaActual: Number(rachaRaw.rachaActual ?? rachaRaw.currentStreak ?? 0),
            rachaMaxima: Number(rachaRaw.rachaMaxima ?? rachaRaw.maxStreak ?? 0),
            totalDiasCompletados: Number(rachaRaw.totalDiasCompletados ?? rachaRaw.totalCompletedDays ?? 0),
            ultimaFechaCompletada: (rachaRaw.ultimaFechaCompletada as string) ?? null,
            todasCompletadasHoy: Boolean(rachaRaw.todasCompletadasHoy),
          },
          misiones: Array.isArray(data.misiones)
            ? data.misiones.map((item: any) => ({
                misionId: item.misionId,
                completada: Boolean(item.completada),
                valorActual: Number(item.valorActual || 0),
                valorObjetivo: Number(item.valorObjetivo || 1),
              }))
            : [],
        };
      }
    }
  } catch (err) {
    console.warn('[mission-api] Could not sync the mission progress with the backend:', err);
  }
  return null;
}


