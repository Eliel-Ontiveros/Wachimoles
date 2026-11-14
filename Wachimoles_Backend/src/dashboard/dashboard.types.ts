import { Request } from "express";

export const SAMPLE_METRICS = [
  "heart_rate",
  "stress",
  "spo2",
  "steps",
  "sleep"
] as const;

export type SampleMetric = (typeof SAMPLE_METRICS)[number];

export const BODY_REGION_CATEGORIES = [
  "Cabeza y cuello",
  "Tronco anterior",
  "Tronco posterior",
  "Extremidad superior",
  "Cadera y pelvis",
  "Extremidad inferior"
] as const;

export type BodyRegionCategory = (typeof BODY_REGION_CATEGORIES)[number];
export type BodyConditionStatus = "active" | "resolved";

export const HEALTH_STATUS_LEVELS = ["normal", "warning", "critical"] as const;
export type HealthStatusLevel = (typeof HEALTH_STATUS_LEVELS)[number];
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export interface DashboardRequest extends Request {
  dashboardUserId: string;
}

export interface DashboardSample {
  id: number;
  sampleId: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measuredAt: string;
  receivedAt: string;
}

export interface SamplesQuery {
  limit?: number;
  metric?: SampleMetric;
}

export interface BodyCondition {
  id: string;
  muscleId: string;
  bodyRegion: BodyRegionCategory;
  muscleName: string;
  conditionName: string;
  description: string | null;
  painIntensity: number;
  swelling: boolean;
  functionalLimitation: boolean;
  status: BodyConditionStatus;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface BodyConditionsQuery {
  limit?: number;
}

export const BODY_CONDITION_IMAGE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export interface UploadedBodyConditionImage {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface BodyConditionImage {
  path: string;
  signedUrl: string;
  expiresAt: string;
}

export interface DailyHealthCheck {
  id: string;
  dateIso: string;
  bloodSugarMgDl: number | null;
  systolicBp: number | null;
  diastolicBp: number | null;
  temperatureC: number | null;
  sleepHours: number | null;
  mood: MoodScore;
  symptoms: string[];
  notes: string | null;
  overallStatus: HealthStatusLevel;
  recommendation: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyHealthChecksQuery {
  limit?: number;
}

export type CategoriaMision =
  | "exercise"
  | "steps"
  | "treadmill"
  | "checkin"
  | "injury_check";

export type DificultadMision =
  | "low"
  | "medium"
  | "high"
  | "baja"
  | "media"
  | "alta";

export type EntornoMision =
  | "earth"
  | "spaceship"
  | "station"
  | "moon"
  | "mars"
  | "tierra"
  | "nave"
  | "estacion"
  | "luna"
  | "marte"
  | "all";

export type UbicacionEspacial =
  | "earth"
  | "station"
  | "moon"
  | "mars"
  | "tierra"
  | "estacion"
  | "luna"
  | "marte";

export type EstadoMision = "scheduled" | "in_transit" | "arrived";

export interface MisionCatalogo {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaMision;
  valorObjetivo: number;
  unidad: string;
  entorno: EntornoMision;
  dificultad: DificultadMision;
  activa: boolean;
  creadoEn: string;
  // Campos en inglés para compatibilidad directa
  title?: string;
  description?: string;
  category?: CategoriaMision;
  targetValue?: number;
  unit?: string;
  environment?: EntornoMision;
  difficulty?: DificultadMision;
}

export interface MisionDiariaRotada extends MisionCatalogo {
  completada: boolean;
  valorActual: number;
  completed: boolean;
  currentValue: number;
}

export interface EstadoMisionAstronauta {
  id: string;
  usuarioId: string;
  origen: UbicacionEspacial;
  destino: UbicacionEspacial;
  fechaSalida: string;
  fechaLlegadaEstimada: string;
  fechaLlegadaReal: string | null;
  diasTotales: number;
  diaActual: number;
  porcentajeProgresoRelativo: number;
  entornoActual: UbicacionEntorno;
  estado: EstadoMision;
  llegadaAnticipada: boolean;
  creadoEn: string;
  actualizadoEn: string;
  // Campos en inglés para compatibilidad con el front
  origin?: UbicacionEspacial;
  destination?: UbicacionEspacial;
  departureDate?: string;
  estimatedArrivalDate?: string;
  actualArrivalDate?: string | null;
  totalDays?: number;
  currentDay?: number;
  relativeProgressPct?: number;
  currentEnvironment?: UbicacionEntorno;
  status?: EstadoMision;
  arrivedEarly?: boolean;
}

export type UbicacionEntorno =
  | "earth"
  | "spaceship"
  | "station"
  | "moon"
  | "mars"
  | "tierra"
  | "nave"
  | "estacion"
  | "luna"
  | "marte";

export interface UbicacionAstronauta {
  usuarioId: string;
  entorno: UbicacionEntorno;
  etiqueta: string;
  gravedadEtiqueta: string;
  actualizadoEn: string;
  // Campos en inglés para compatibilidad
  userId?: string;
  environment?: UbicacionEntorno;
  label?: string;
  gravityLabel?: string;
  updatedAt?: string;
}

export interface SupabaseAstronautLocationRow {
  id: string;
  user_id: string;
  entorno: UbicacionEntorno;
  actualizado_en: string;
}

export interface MisionDiariaProgreso {
  misionId: string;
  completada: boolean;
  valorActual: number;
  valorObjetivo: number;
  actualizadoEn?: string;
  // Campos en inglés
  missionId?: string;
  completed?: boolean;
  currentValue?: number;
  targetValue?: number;
}

export interface ResumenDiaMisiones {
  fecha: string;
  totalMisiones: number;
  misionesCompletadas: number;
  todasCompletadas: boolean;
  puntoRachaOtorgado: boolean;
  actualizadoEn?: string;
  // Campos en inglés
  date?: string;
  totalMissions?: number;
  completedMissions?: number;
  allCompleted?: boolean;
  streakPointAwarded?: boolean;
}

export interface RachaAstronauta {
  usuarioId: string;
  rachaActual: number;
  rachaMaxima: number;
  totalDiasCompletados: number;
  ultimaFechaCompletada: string | null;
  todasCompletadasHoy: boolean;
  actualizadoEn: string;
  // Campos en inglés
  userId?: string;
  currentStreak?: number;
  maxStreak?: number;
  totalCompletedDays?: number;
  lastCompletedDate?: string | null;
  allCompletedToday?: boolean;
  updatedAt?: string;
}

export interface RespuestaProgresoMisiones {
  fecha: string;
  totalMisiones: number;
  misionesCompletadas: number;
  todasCompletadas: boolean;
  puntoRachaOtorgado: boolean;
  racha: RachaAstronauta;
  misiones: MisionDiariaProgreso[];
}

export interface SupabaseDailyMissionCompletionRow {
  id: string;
  user_id: string;
  fecha: string;
  mision_id: string;
  completada: boolean;
  valor_actual: number;
  valor_objetivo: number;
  actualizado_en: string;
}

export interface SupabaseDailyMissionDayRow {
  id: string;
  user_id: string;
  fecha: string;
  total_misiones: number;
  misiones_completadas: number;
  todas_completadas: boolean;
  punto_racha_otorgado: boolean;
  actualizado_en: string;
}

export interface SupabaseAstronautStreakRow {
  user_id: string;
  racha_actual: number;
  racha_maxima: number;
  total_dias_completados: number;
  ultima_fecha_completada: string | null;
  actualizado_en: string;
}


