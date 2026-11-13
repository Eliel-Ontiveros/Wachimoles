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
  muscleId: string,
  payload: unknown
): Promise<{ synced: boolean }> {
  const baseUrl = API_CONFIG.localUrls[0];
  try {
    const res = await fetch(`${baseUrl}/observations/${muscleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: API_CONFIG.userId, payload }),
    });
    return { synced: res.ok };
  } catch {
    return { synced: false };
  }
}

// Endpoint listo para guardar cuestionario médico diario en el backend
export async function syncHealthCheckToBackend(
  check: DailyHealthCheck
): Promise<{ synced: boolean }> {
  const baseUrl = API_CONFIG.localUrls[0];
  try {
    const res = await fetch(`${baseUrl}/observations/health-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: API_CONFIG.userId, ...check }),
    });
    return { synced: res.ok };
  } catch {
    return { synced: false };
  }
}

