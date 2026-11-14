import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import {
  BODY_CONDITION_IMAGE_MAX_SIZE_BYTES,
  BodyConditionImage,
  BodyCondition,
  BodyConditionStatus,
  BodyConditionsQuery,
  BODY_REGION_CATEGORIES,
  BodyRegionCategory,
  DailyHealthCheck,
  DailyHealthChecksQuery,
  DashboardSample,
  HealthStatusLevel,
  MoodScore,
  SamplesQuery,
  SampleMetric,
  UploadedBodyConditionImage,
  CategoriaMision,
  DificultadMision,
  EntornoMision,
  UbicacionEspacial,
  EstadoMision,
  MisionCatalogo,
  MisionDiariaRotada,
  EstadoMisionAstronauta
} from "./dashboard.types";
import { SaveDailyHealthCheckDto } from "./daily-health-checks.dto";
import { SaveBodyConditionDto } from "./body-conditions.dto";
import { ConsultarMisionesQueryDto } from "./missions.dto";
import { GuardarEstadoMisionDto, LlegadaAnticipadaDto } from "./astronaut-mission.dto";

interface SupabaseSampleRow {
  id: number;
  sample_id: string;
  metric: SampleMetric;
  value: number;
  unit: string;
  measured_at: string;
  received_at: string;
}

interface SupabaseBodyConditionRow {
  id: string;
  muscle_id: string;
  body_region: BodyRegionCategory;
  muscle_name: string;
  condition_name: string;
  description: string | null;
  pain_intensity: number;
  swelling: boolean;
  functional_limitation: boolean;
  status: BodyConditionStatus;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface SupabaseDailyHealthCheckRow {
  id: string;
  date_iso: string;
  blood_sugar_mg_dl: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  temperature_c: number | null;
  sleep_hours: number | null;
  mood: MoodScore;
  symptoms: string[];
  notes: string | null;
  overall_status: HealthStatusLevel;
  recommendation: string;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

interface SupabaseStorageObject {
  name: string;
}

const BODY_CONDITION_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSupabaseStorageObject(value: unknown): value is SupabaseStorageObject {
  return isRecord(value) && typeof value.name === "string";
}

function getImageExtension(file: UploadedBodyConditionImage): string {
  const isJpeg =
    file.mimetype === "image/jpeg" &&
    file.buffer.length >= 3 &&
    file.buffer[0] === 0xff &&
    file.buffer[1] === 0xd8 &&
    file.buffer[2] === 0xff;
  const isPng =
    file.mimetype === "image/png" &&
    file.buffer.length >= 8 &&
    file.buffer.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  const isWebp =
    file.mimetype === "image/webp" &&
    file.buffer.length >= 12 &&
    file.buffer.toString("ascii", 0, 4) === "RIFF" &&
    file.buffer.toString("ascii", 8, 12) === "WEBP";

  if (isJpeg) {
    return "jpg";
  }
  if (isPng) {
    return "png";
  }
  if (isWebp) {
    return "webp";
  }

  throw new BadRequestException(
    "Only valid JPEG, PNG, and WebP images are supported."
  );
}

function isBodyRegionCategory(value: unknown): value is BodyRegionCategory {
  return (
    typeof value === "string" &&
    BODY_REGION_CATEGORIES.some((category) => category === value)
  );
}

function isHealthStatusLevel(value: unknown): value is HealthStatusLevel {
  return value === "normal" || value === "warning" || value === "critical";
}

function isMoodScore(value: unknown): value is MoodScore {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isSupabaseSampleRow(value: unknown): value is SupabaseSampleRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isSafeInteger(value.id) &&
    typeof value.sample_id === "string" &&
    typeof value.metric === "string" &&
    ["heart_rate", "stress", "spo2", "steps", "sleep"].includes(value.metric) &&
    typeof value.value === "number" &&
    Number.isFinite(value.value) &&
    typeof value.unit === "string" &&
    typeof value.measured_at === "string" &&
    typeof value.received_at === "string"
  );
}

function isSupabaseBodyConditionRow(
  value: unknown
): value is SupabaseBodyConditionRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.muscle_id === "string" &&
    isBodyRegionCategory(value.body_region) &&
    typeof value.muscle_name === "string" &&
    typeof value.condition_name === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    Number.isInteger(value.pain_intensity) &&
    typeof value.swelling === "boolean" &&
    typeof value.functional_limitation === "boolean" &&
    (value.status === "active" || value.status === "resolved") &&
    typeof value.recorded_at === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string" &&
    (typeof value.resolved_at === "string" || value.resolved_at === null)
  );
}

function mapBodyCondition(row: SupabaseBodyConditionRow): BodyCondition {
  return {
    id: row.id,
    muscleId: row.muscle_id,
    bodyRegion: row.body_region,
    muscleName: row.muscle_name,
    conditionName: row.condition_name,
    description: row.description,
    painIntensity: row.pain_intensity,
    swelling: row.swelling,
    functionalLimitation: row.functional_limitation,
    status: row.status,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at
  };
}

function isSupabaseDailyHealthCheckRow(
  value: unknown
): value is SupabaseDailyHealthCheckRow {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.date_iso === "string" &&
    isNullableFiniteNumber(value.blood_sugar_mg_dl) &&
    isNullableFiniteNumber(value.systolic_bp) &&
    isNullableFiniteNumber(value.diastolic_bp) &&
    isNullableFiniteNumber(value.temperature_c) &&
    isNullableFiniteNumber(value.sleep_hours) &&
    isMoodScore(value.mood) &&
    Array.isArray(value.symptoms) &&
    value.symptoms.every((symptom) => typeof symptom === "string") &&
    (typeof value.notes === "string" || value.notes === null) &&
    isHealthStatusLevel(value.overall_status) &&
    typeof value.recommendation === "string" &&
    typeof value.recorded_at === "string" &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function mapDailyHealthCheck(
  row: SupabaseDailyHealthCheckRow
): DailyHealthCheck {
  return {
    id: row.id,
    dateIso: row.date_iso,
    bloodSugarMgDl: row.blood_sugar_mg_dl,
    systolicBp: row.systolic_bp,
    diastolicBp: row.diastolic_bp,
    temperatureC: row.temperature_c,
    sleepHours: row.sleep_hours,
    mood: row.mood,
    symptoms: row.symptoms,
    notes: row.notes,
    overallStatus: row.overall_status,
    recommendation: row.recommendation,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

interface SupabaseMissionRow {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: CategoriaMision;
  valor_objetivo: number;
  unidad: string;
  entorno: EntornoMision;
  dificultad: DificultadMision;
  activa: boolean;
  creado_en?: string;
}

interface SupabaseAstronautMissionStateRow {
  id: string;
  user_id: string;
  origen: UbicacionEspacial;
  destino: UbicacionEspacial;
  fecha_salida: string;
  fecha_llegada_estimada: string;
  fecha_llegada_real: string | null;
  dias_totales: number | string;
  dia_actual: number | string;
  porcentaje_progreso_relativo: number | string;
  entorno_actual: "tierra" | "nave" | "estacion" | "luna" | "marte";
  estado: EstadoMision;
  llegada_anticipada: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

function mapMission(row: SupabaseMissionRow): MisionCatalogo {
  const target = Number(row.valor_objetivo);
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    categoria: row.categoria,
    valorObjetivo: target,
    unidad: row.unidad,
    entorno: row.entorno,
    dificultad: row.dificultad,
    activa: row.activa,
    creadoEn: row.creado_en ?? new Date().toISOString(),
    title: row.titulo,
    description: row.descripcion,
    category: row.categoria,
    targetValue: target,
    unit: row.unidad,
    environment: row.entorno,
    difficulty: row.dificultad
  };
}

function mapAstronautMissionState(
  row: SupabaseAstronautMissionStateRow
): EstadoMisionAstronauta {
  const diasTotales = Number(row.dias_totales);
  const diaActual = Number(row.dia_actual);
  const porcentajeProgresoRelativo = Number(row.porcentaje_progreso_relativo);
  const fechaSalida = row.fecha_salida;
  const fechaLlegadaEstimada = row.fecha_llegada_estimada;
  const fechaLlegadaReal = row.fecha_llegada_real;
  const origen = row.origen;
  const destino = row.destino;
  const entornoActual = row.entorno_actual;
  const estado = row.estado;
  const llegadaAnticipada = Boolean(row.llegada_anticipada);
  const ahoraIso = new Date().toISOString();
  const creadoEn = row.creado_en ?? ahoraIso;
  const actualizadoEn = row.actualizado_en ?? ahoraIso;

  return {
    id: row.id,
    usuarioId: row.user_id,
    origen,
    destino,
    fechaSalida,
    fechaLlegadaEstimada,
    fechaLlegadaReal,
    diasTotales,
    diaActual,
    porcentajeProgresoRelativo,
    entornoActual,
    estado,
    llegadaAnticipada,
    creadoEn,
    actualizadoEn,
    origin: origen,
    destination: destino,
    departureDate: fechaSalida,
    estimatedArrivalDate: fechaLlegadaEstimada,
    actualArrivalDate: fechaLlegadaReal,
    totalDays: diasTotales,
    currentDay: diaActual,
    relativeProgressPct: porcentajeProgresoRelativo,
    currentEnvironment: entornoActual,
    status: estado,
    arrivedEarly: llegadaAnticipada
  };
}

const MISIONES_SEMILLA_POR_DEFECTO: MisionCatalogo[] = [
  {
    id: "checkin-diario",
    titulo: "Check-in médico diario",
    descripcion: "Confirmar estado general, signos y cuestionario para mantener la racha de salud.",
    categoria: "checkin",
    valorObjetivo: 1,
    unidad: "check",
    entorno: "all",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Check-in médico diario",
    description: "Confirmar estado general, signos y cuestionario para mantener la racha de salud.",
    category: "checkin",
    targetValue: 1,
    unit: "check",
    environment: "all",
    difficulty: "baja"
  },
  {
    id: "control-lesiones",
    titulo: "Inspección fotográfica de zonas de dolor",
    descripcion: "Tomar registro visual de inflamación muscular o piel.",
    categoria: "injury_check",
    valorObjetivo: 1,
    unidad: "check",
    entorno: "all",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Inspección fotográfica de zonas de dolor",
    description: "Tomar registro visual de inflamación muscular o piel.",
    category: "injury_check",
    targetValue: 1,
    unit: "check",
    environment: "all",
    difficulty: "media"
  },
  {
    id: "tierra-pasos-baja",
    titulo: "Caminata ligera de acondicionamiento",
    descripcion: "Día suave: marcha regenerativa y reactivación cardiovascular básica.",
    categoria: "steps",
    valorObjetivo: 3500,
    unidad: "pasos",
    entorno: "tierra",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminata ligera de acondicionamiento",
    description: "Día suave: marcha regenerativa y reactivación cardiovascular básica.",
    category: "steps",
    targetValue: 3500,
    unit: "pasos",
    environment: "tierra",
    difficulty: "baja"
  },
  {
    id: "tierra-pasos-media",
    titulo: "Meta estándar de pasos en base",
    descripcion: "Día moderado: mantenimiento de tono muscular y circulación bajo gravedad terrestre.",
    categoria: "steps",
    valorObjetivo: 7000,
    unidad: "pasos",
    entorno: "tierra",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Meta estándar de pasos en base",
    description: "Día moderado: mantenimiento de tono muscular y circulación bajo gravedad terrestre.",
    category: "steps",
    targetValue: 7000,
    unit: "pasos",
    environment: "tierra",
    difficulty: "media"
  },
  {
    id: "tierra-pasos-alta",
    titulo: "Marcha de alta resistencia terrestre",
    descripcion: "Día intenso: preparación física de alta demanda y capacidad pulmonar.",
    categoria: "steps",
    valorObjetivo: 11000,
    unidad: "pasos",
    entorno: "tierra",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Marcha de alta resistencia terrestre",
    description: "Día intenso: preparación física de alta demanda y capacidad pulmonar.",
    category: "steps",
    targetValue: 11000,
    unit: "pasos",
    environment: "tierra",
    difficulty: "alta"
  },
  {
    id: "tierra-core-baja",
    titulo: "Movilidad articular y estiramiento core",
    descripcion: "Rutina suave para descargar columna y flexibilidad.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "tierra",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Movilidad articular y estiramiento core",
    description: "Rutina suave para descargar columna y flexibilidad.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "tierra",
    difficulty: "baja"
  },
  {
    id: "tierra-cardio-media",
    titulo: "Acondicionamiento aeróbico 1g",
    descripcion: "Entrenamiento cardiovascular moderado para resistencia muscular.",
    categoria: "exercise",
    valorObjetivo: 30,
    unidad: "min",
    entorno: "tierra",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Acondicionamiento aeróbico 1g",
    description: "Entrenamiento cardiovascular moderado para resistencia muscular.",
    category: "exercise",
    targetValue: 30,
    unit: "min",
    environment: "tierra",
    difficulty: "media"
  },
  {
    id: "tierra-fuerza-alta",
    titulo: "Entrenamiento de fuerza y carga máxima",
    descripcion: "Sesión exigente de fuerza funcional para readaptación motora.",
    categoria: "exercise",
    valorObjetivo: 45,
    unidad: "min",
    entorno: "tierra",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Entrenamiento de fuerza y carga máxima",
    description: "Sesión exigente de fuerza funcional para readaptación motora.",
    category: "exercise",
    targetValue: 45,
    unit: "min",
    environment: "tierra",
    difficulty: "alta"
  },
  {
    id: "nave-treadmill-baja",
    titulo: "Caminadora T2 en 0g: marcha suave",
    descripcion: "Día suave: sesión ligera con sujeción elástica para prevenir trombosis.",
    categoria: "treadmill",
    valorObjetivo: 2500,
    unidad: "pasos",
    entorno: "nave",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminadora T2 en 0g: marcha suave",
    description: "Día suave: sesión ligera con sujeción elástica para prevenir trombosis.",
    category: "treadmill",
    targetValue: 2500,
    unit: "pasos",
    environment: "nave",
    difficulty: "baja"
  },
  {
    id: "nave-treadmill-media",
    titulo: "Caminadora T2 en 0g: carga estándar",
    descripcion: "Día moderado: impacto controlado contra arnés para frenar desmineralización.",
    categoria: "treadmill",
    valorObjetivo: 4500,
    unidad: "pasos",
    entorno: "nave",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminadora T2 en 0g: carga estándar",
    description: "Día moderado: impacto controlado contra arnés para frenar desmineralización.",
    category: "treadmill",
    targetValue: 4500,
    unit: "pasos",
    environment: "nave",
    difficulty: "media"
  },
  {
    id: "nave-treadmill-alta",
    titulo: "Caminadora T2 en 0g: simulación extrema",
    descripcion: "Día exigente: cadencia rápida para exigir sistema cardiovascular y huesos largos.",
    categoria: "treadmill",
    valorObjetivo: 7500,
    unidad: "pasos",
    entorno: "nave",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminadora T2 en 0g: simulación extrema",
    description: "Día exigente: cadencia rápida para exigir sistema cardiovascular y huesos largos.",
    category: "treadmill",
    targetValue: 7500,
    unit: "pasos",
    environment: "nave",
    difficulty: "alta"
  },
  {
    id: "nave-stretch-baja",
    titulo: "Descompresión espinal en cabina",
    descripcion: "Estiramiento suave lumbar y cervical para elongación 0g.",
    categoria: "exercise",
    valorObjetivo: 10,
    unidad: "min",
    entorno: "nave",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Descompresión espinal en cabina",
    description: "Estiramiento suave lumbar y cervical para elongación 0g.",
    category: "exercise",
    targetValue: 10,
    unit: "min",
    environment: "nave",
    difficulty: "baja"
  },
  {
    id: "nave-ared-media",
    titulo: "Rutina resistiva ARED moderada",
    descripcion: "Ejercicios de fuerza contra resistencia de vacío para cuádriceps y espalda.",
    categoria: "exercise",
    valorObjetivo: 25,
    unidad: "min",
    entorno: "nave",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Rutina resistiva ARED moderada",
    description: "Ejercicios de fuerza contra resistencia de vacío para cuádriceps y espalda.",
    category: "exercise",
    targetValue: 25,
    unit: "min",
    environment: "nave",
    difficulty: "media"
  },
  {
    id: "nave-ared-alta",
    titulo: "Fuerza intensiva ARED contra atrofia severa",
    descripcion: "Protocolo de hipertrofia y compresión axial profunda en ingravidez.",
    categoria: "exercise",
    valorObjetivo: 40,
    unidad: "min",
    entorno: "nave",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Fuerza intensiva ARED contra atrofia severa",
    description: "Protocolo de hipertrofia y compresión axial profunda en ingravidez.",
    category: "exercise",
    targetValue: 40,
    unit: "min",
    environment: "nave",
    difficulty: "alta"
  },
  {
    id: "estacion-treadmill-baja",
    titulo: "Caminadora T2 en EEI: trote ligero",
    descripcion: "Sesión breve de amortiguación en módulo de servicio.",
    categoria: "treadmill",
    valorObjetivo: 3000,
    unidad: "pasos",
    entorno: "estacion",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminadora T2 en EEI: trote ligero",
    description: "Sesión breve de amortiguación en módulo de servicio.",
    category: "treadmill",
    targetValue: 3000,
    unit: "pasos",
    environment: "estacion",
    difficulty: "baja"
  },
  {
    id: "estacion-treadmill-media",
    titulo: "Caminadora T2 en EEI: entrenamiento orbital",
    descripcion: "Protocolo diario para mantener gasto calórico y estabilidad en 0g.",
    categoria: "treadmill",
    valorObjetivo: 5000,
    unidad: "pasos",
    entorno: "estacion",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminadora T2 en EEI: entrenamiento orbital",
    description: "Protocolo diario para mantener gasto calórico y estabilidad en 0g.",
    category: "treadmill",
    targetValue: 5000,
    unit: "pasos",
    environment: "estacion",
    difficulty: "media"
  },
  {
    id: "estacion-treadmill-alta",
    titulo: "Caminadora T2 en EEI: protocolo intensivo",
    descripcion: "Día de alta carga motriz con resistencia incrementada.",
    categoria: "treadmill",
    valorObjetivo: 8000,
    unidad: "pasos",
    entorno: "estacion",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Caminadora T2 en EEI: protocolo intensivo",
    description: "Día de alta carga motriz con resistencia incrementada.",
    category: "treadmill",
    targetValue: 8000,
    unit: "pasos",
    environment: "estacion",
    difficulty: "alta"
  },
  {
    id: "estacion-sans-baja",
    titulo: "Control cefálico y pausa visual SANS",
    descripcion: "Relajación ocular y alivio de presión intracraneal en microgravedad.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "estacion",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Control cefálico y pausa visual SANS",
    description: "Relajación ocular y alivio de presión intracraneal en microgravedad.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "estacion",
    difficulty: "baja"
  },
  {
    id: "estacion-ared-media",
    titulo: "Resistencia ARED en módulo orbital",
    descripcion: "Compresión ósea en tren inferior y zona escapular.",
    categoria: "exercise",
    valorObjetivo: 25,
    unidad: "min",
    entorno: "estacion",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Resistencia ARED en módulo orbital",
    description: "Compresión ósea en tren inferior y zona escapular.",
    category: "exercise",
    targetValue: 25,
    unit: "min",
    environment: "estacion",
    difficulty: "media"
  },
  {
    id: "estacion-fuerza-alta",
    titulo: "Carga máxima ARED y trabajo isométrico",
    descripcion: "Entrenamiento estricto para simular gravedad terrestre en masa muscular.",
    categoria: "exercise",
    valorObjetivo: 45,
    unidad: "min",
    entorno: "estacion",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Carga máxima ARED y trabajo isométrico",
    description: "Entrenamiento estricto para simular gravedad terrestre en masa muscular.",
    category: "exercise",
    targetValue: 45,
    unit: "min",
    environment: "estacion",
    difficulty: "alta"
  },
  {
    id: "luna-pasos-baja",
    titulo: "Patrulla corta en regolito lunar",
    descripcion: "Día suave: caminata de reconocimiento en entorno de baja tracción.",
    categoria: "steps",
    valorObjetivo: 4000,
    unidad: "pasos",
    entorno: "luna",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Patrulla corta en regolito lunar",
    description: "Día suave: caminata de reconocimiento en entorno de baja tracción.",
    category: "steps",
    targetValue: 4000,
    unit: "pasos",
    environment: "luna",
    difficulty: "baja"
  },
  {
    id: "luna-pasos-media",
    titulo: "Marcha de exploración lunar estándar",
    descripcion: "Día moderado: desplazamiento entre domos y plataformas de carga.",
    categoria: "steps",
    valorObjetivo: 6500,
    unidad: "pasos",
    entorno: "luna",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Marcha de exploración lunar estándar",
    description: "Día moderado: desplazamiento entre domos y plataformas de carga.",
    category: "steps",
    targetValue: 6500,
    unit: "pasos",
    environment: "luna",
    difficulty: "media"
  },
  {
    id: "luna-pasos-alta",
    titulo: "Travesía prolongada de superficie lunar",
    descripcion: "Día intenso: navegación a pie de cráter con traje presurizado.",
    categoria: "steps",
    valorObjetivo: 9500,
    unidad: "pasos",
    entorno: "luna",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Travesía prolongada de superficie lunar",
    description: "Día intenso: navegación a pie de cráter con traje presurizado.",
    category: "steps",
    targetValue: 9500,
    unit: "pasos",
    environment: "luna",
    difficulty: "alta"
  },
  {
    id: "luna-balance-baja",
    titulo: "Control postural y estabilidad de tobillo",
    descripcion: "Recuperación de propiocepción en 0.16g tras caminata con botas EVA.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "luna",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Control postural y estabilidad de tobillo",
    description: "Recuperación de propiocepción en 0.16g tras caminata con botas EVA.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "luna",
    difficulty: "baja"
  },
  {
    id: "luna-eva-media",
    titulo: "Movilidad y descarga articular post-EVA",
    descripcion: "Alivio de tendones patelares y deltoides por peso del traje espacial.",
    categoria: "exercise",
    valorObjetivo: 25,
    unidad: "min",
    entorno: "luna",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Movilidad y descarga articular post-EVA",
    description: "Alivio de tendones patelares y deltoides por peso del traje espacial.",
    category: "exercise",
    targetValue: 25,
    unit: "min",
    environment: "luna",
    difficulty: "media"
  },
  {
    id: "luna-carga-alta",
    titulo: "Fuerza funcional con gravedad reducida",
    descripcion: "Sentadillas de potencia y estabilidad lumbar contra regolito.",
    categoria: "exercise",
    valorObjetivo: 40,
    unidad: "min",
    entorno: "luna",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Fuerza funcional con gravedad reducida",
    description: "Sentadillas de potencia y estabilidad lumbar contra regolito.",
    category: "exercise",
    targetValue: 40,
    unit: "min",
    environment: "luna",
    difficulty: "alta"
  },
  {
    id: "marte-pasos-baja",
    titulo: "Aclimatación en hábitat marciano",
    descripcion: "Día suave: ronda interior y ajuste a la gravedad de 0.38g.",
    categoria: "steps",
    valorObjetivo: 5000,
    unidad: "pasos",
    entorno: "marte",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Aclimatación en hábitat marciano",
    description: "Día suave: ronda interior y ajuste a la gravedad de 0.38g.",
    category: "steps",
    targetValue: 5000,
    unit: "pasos",
    environment: "marte",
    difficulty: "baja"
  },
  {
    id: "marte-pasos-media",
    titulo: "Ruta de recolección en superficie marciana",
    descripcion: "Día moderado: expedición geológica y paso constante sobre dunas.",
    categoria: "steps",
    valorObjetivo: 8500,
    unidad: "pasos",
    entorno: "marte",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Ruta de recolección en superficie marciana",
    description: "Día moderado: expedición geológica y paso constante sobre dunas.",
    category: "steps",
    targetValue: 8500,
    unit: "pasos",
    environment: "marte",
    difficulty: "media"
  },
  {
    id: "marte-pasos-alta",
    titulo: "Marcha extrema en terreno rocoso marciano",
    descripcion: "Día de alta exigencia física en suelo hostil y pendiente pronunciada.",
    categoria: "steps",
    valorObjetivo: 12000,
    unidad: "pasos",
    entorno: "marte",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Marcha extrema en terreno rocoso marciano",
    description: "Día de alta exigencia física en suelo hostil y pendiente pronunciada.",
    category: "steps",
    targetValue: 12000,
    unit: "pasos",
    environment: "marte",
    difficulty: "alta"
  },
  {
    id: "marte-resp-baja",
    titulo: "Respiración diafragmática y revisión SpO2",
    descripcion: "Desaturación de polvo y ventilación guiada en esclusa.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "marte",
    dificultad: "baja",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Respiración diafragmática y revisión SpO2",
    description: "Desaturación de polvo y ventilación guiada en esclusa.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "marte",
    difficulty: "baja"
  },
  {
    id: "marte-load-media",
    titulo: "Entrenamiento de carga en 0.38g",
    descripcion: "Fortalecimiento de erectores espinales y cuádriceps para gravedad marciana.",
    categoria: "exercise",
    valorObjetivo: 30,
    unidad: "min",
    entorno: "marte",
    dificultad: "media",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Entrenamiento de carga en 0.38g",
    description: "Fortalecimiento de erectores espinales y cuádriceps para gravedad marciana.",
    category: "exercise",
    targetValue: 30,
    unit: "min",
    environment: "marte",
    difficulty: "media"
  },
  {
    id: "marte-load-alta",
    titulo: "Sobrecarga muscular y resistencia extrema",
    descripcion: "Protocolo avanzado de potencia y soporte de carga pesada.",
    categoria: "exercise",
    valorObjetivo: 45,
    unidad: "min",
    entorno: "marte",
    dificultad: "alta",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Sobrecarga muscular y resistencia extrema",
    description: "Protocolo avanzado de potencia y soporte de carga pesada.",
    category: "exercise",
    targetValue: 45,
    unit: "min",
    environment: "marte",
    difficulty: "alta"
  }
];

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly supabaseUrl: string;
  private readonly serviceRoleKey: string;
  private readonly storageBucket: string;

  constructor(config: ConfigService) {
    this.supabaseUrl = config.getOrThrow<string>("SUPABASE_URL");
    this.serviceRoleKey = config.getOrThrow<string>(
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    this.storageBucket = config.get<string>("SUPABASE_STORAGE_BUCKET")?.trim() ?? "";
  }

  async getSamples(
    userId: string,
    query: SamplesQuery
  ): Promise<DashboardSample[]> {
    const url = new URL(`${this.supabaseUrl}/rest/v1/samples`);
    url.searchParams.set(
      "select",
      "id,sample_id,metric,value,unit,measured_at,received_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "measured_at.desc,id.desc");
    url.searchParams.set("limit", String(query.limit ?? 100));
    if (query.metric) {
      url.searchParams.set("metric", `eq.${query.metric}`);
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      this.logger.error("Supabase database could not be reached.", error);
      throw new ServiceUnavailableException(
        "Dashboard database is temporarily unavailable."
      );
    }

    if (!response.ok) {
      let databaseError: unknown;
      try {
        databaseError = await response.json();
      } catch {
        databaseError = null;
      }

      const code =
        isRecord(databaseError) && typeof databaseError.code === "string"
          ? databaseError.code
          : "unknown";
      const message =
        isRecord(databaseError) && typeof databaseError.message === "string"
          ? databaseError.message.slice(0, 300)
          : "No error message returned.";
      this.logger.error(
        `Supabase database returned HTTP ${response.status} (${code}): ${message}`
      );
      throw new ServiceUnavailableException(
        "Dashboard data could not be loaded."
      );
    }

    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error("Supabase database returned invalid JSON.", error);
      throw new ServiceUnavailableException(
        "Dashboard database returned an invalid response."
      );
    }

    if (!Array.isArray(rows) || !rows.every(isSupabaseSampleRow)) {
      this.logger.error("Supabase database returned an unexpected sample shape.");
      throw new ServiceUnavailableException(
        "Dashboard database returned an invalid sample response."
      );
    }

    return rows.map((row) => ({
      id: row.id,
      sampleId: row.sample_id,
      metric: row.metric,
      value: row.value,
      unit: row.unit,
      measuredAt: row.measured_at,
      receivedAt: row.received_at
    }));
  }

  async getBodyConditions(
    userId: string,
    query: BodyConditionsQuery
  ): Promise<BodyCondition[]> {
    const url = this.getBodyConditionsUrl();
    url.searchParams.set(
      "select",
      "id,muscle_id,body_region,muscle_name,condition_name,description,pain_intensity,swelling,functional_limitation,status,recorded_at,created_at,updated_at,resolved_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "recorded_at.desc,id.desc");
    url.searchParams.set("limit", String(query.limit ?? 100));

    const response = await this.requestSupabaseTable(
      url,
      { method: "GET" },
      "body-condition"
    );
    const rows = await this.parseBodyConditionRows(response);
    return rows.map(mapBodyCondition);
  }

  async saveBodyCondition(
    userId: string,
    muscleId: string,
    body: SaveBodyConditionDto
  ): Promise<BodyCondition> {
    const url = this.getBodyConditionsUrl();
    url.searchParams.set("on_conflict", "user_id,muscle_id");
    const recordedAt = new Date().toISOString();
    const response = await this.requestSupabaseTable(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          muscle_id: muscleId,
          body_region: body.bodyRegion,
          muscle_name: body.muscleName.trim(),
          condition_name: body.conditionName.trim(),
          description: body.description?.trim() || null,
          pain_intensity: body.painIntensity,
          swelling: body.swelling,
          functional_limitation: body.functionalLimitation,
          status: "active",
          recorded_at: recordedAt,
          updated_at: recordedAt,
          resolved_at: null
        })
      },
      "body-condition"
    );
    const rows = await this.parseBodyConditionRows(response);
    if (rows.length !== 1) {
      this.logger.error("Supabase did not return the saved body condition.");
      throw new ServiceUnavailableException(
        "The body condition could not be saved."
      );
    }

    return mapBodyCondition(rows[0]);
  }

  async resolveBodyCondition(
    userId: string,
    muscleId: string
  ): Promise<{ resolved: true }> {
    const url = this.getBodyConditionsUrl();
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("muscle_id", `eq.${muscleId}`);
    url.searchParams.set("status", "eq.active");
    const resolvedAt = new Date().toISOString();

    await this.requestSupabaseTable(
      url,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          status: "resolved",
          resolved_at: resolvedAt,
          updated_at: resolvedAt
        })
      },
      "body-condition"
    );

    return { resolved: true };
  }

  async uploadBodyConditionImage(
    userId: string,
    muscleId: string,
    file: UploadedBodyConditionImage | undefined
  ): Promise<BodyConditionImage> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("An image file is required.");
    }
    if (
      file.size > BODY_CONDITION_IMAGE_MAX_SIZE_BYTES ||
      file.buffer.length > BODY_CONDITION_IMAGE_MAX_SIZE_BYTES
    ) {
      throw new PayloadTooLargeException(
        "The image must not exceed 10 MB."
      );
    }

    const extension = getImageExtension(file);
    const path = `${userId}/${muscleId}/${randomUUID()}.${extension}`;
    const response = await this.requestStorage(
      this.getStorageObjectUrl(null, path),
      {
        method: "POST",
        headers: { "Content-Type": file.mimetype },
        body: new Blob([Uint8Array.from(file.buffer)], {
          type: file.mimetype
        })
      },
      "upload body-condition image"
    );
    await response.arrayBuffer();

    return this.createSignedBodyConditionImage(path);
  }

  async getBodyConditionImages(
    userId: string,
    muscleId: string
  ): Promise<BodyConditionImage[]> {
    const prefix = `${userId}/${muscleId}/`;
    const response = await this.requestStorage(
      this.getStorageObjectUrl("list"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          limit: 100,
          offset: 0,
          sortBy: { column: "created_at", order: "desc" }
        })
      },
      "list body-condition images"
    );

    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error("Supabase Storage returned invalid image-list JSON.", error);
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid image-list response."
      );
    }

    if (
      !Array.isArray(rows) ||
      !rows.every(
        (row) =>
          isSupabaseStorageObject(row) &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
            row.name
          )
      )
    ) {
      this.logger.error("Supabase Storage returned an unexpected image-list shape.");
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid image-list response."
      );
    }

    return Promise.all(
      rows.map((row) =>
        this.createSignedBodyConditionImage(`${prefix}${row.name}`)
      )
    );
  }

  async deleteBodyConditionImage(
    userId: string,
    muscleId: string,
    fileName: string
  ): Promise<{ deleted: true }> {
    const response = await this.requestStorage(
      this.getStorageObjectUrl(null),
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefixes: [`${userId}/${muscleId}/${fileName}`]
        })
      },
      "delete body-condition image"
    );
    await response.arrayBuffer();
    return { deleted: true };
  }

  async getDailyHealthChecks(
    userId: string,
    query: DailyHealthChecksQuery
  ): Promise<DailyHealthCheck[]> {
    const url = this.getDailyHealthChecksUrl();
    url.searchParams.set(
      "select",
      "id,date_iso,blood_sugar_mg_dl,systolic_bp,diastolic_bp,temperature_c,sleep_hours,mood,symptoms,notes,overall_status,recommendation,recorded_at,created_at,updated_at"
    );
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "date_iso.desc,recorded_at.desc");
    url.searchParams.set("limit", String(query.limit ?? 100));

    const response = await this.requestSupabaseTable(
      url,
      { method: "GET" },
      "daily health-check"
    );
    const rows = await this.parseDailyHealthCheckRows(response);
    return rows.map(mapDailyHealthCheck);
  }

  async saveDailyHealthCheck(
    userId: string,
    dateIso: string,
    body: SaveDailyHealthCheckDto
  ): Promise<DailyHealthCheck> {
    const url = this.getDailyHealthChecksUrl();
    url.searchParams.set("on_conflict", "user_id,date_iso");
    const recordedAt = new Date().toISOString();
    const response = await this.requestSupabaseTable(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify({
          user_id: userId,
          date_iso: dateIso,
          blood_sugar_mg_dl: body.bloodSugarMgDl ?? null,
          systolic_bp: body.systolicBp ?? null,
          diastolic_bp: body.diastolicBp ?? null,
          temperature_c: body.temperatureC ?? null,
          sleep_hours: body.sleepHours ?? null,
          mood: body.mood,
          symptoms: body.symptoms,
          notes: body.notes?.trim() || null,
          overall_status: body.overallStatus,
          recommendation: body.recommendation.trim(),
          recorded_at: recordedAt,
          updated_at: recordedAt
        })
      },
      "daily health-check"
    );
    const rows = await this.parseDailyHealthCheckRows(response);
    if (rows.length !== 1) {
      this.logger.error("Supabase did not return the saved daily health check.");
      throw new ServiceUnavailableException(
        "The daily health check could not be saved."
      );
    }

    return mapDailyHealthCheck(rows[0]);
  }

  private getBodyConditionsUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/body_conditions`);
  }

  private getDailyHealthChecksUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/daily_health_checks`);
  }

  private getStorageObjectUrl(operation: string | null, path?: string): URL {
    if (!this.storageBucket) {
      throw new ServiceUnavailableException(
        "Image storage is not configured. Set SUPABASE_STORAGE_BUCKET."
      );
    }

    const bucket = encodeURIComponent(this.storageBucket);
    const objectPath = path
      ? `/${path.split("/").map(encodeURIComponent).join("/")}`
      : "";
    const operationPath = operation ? `/${operation}` : "";
    return new URL(
      `${this.supabaseUrl}/storage/v1/object${operationPath}/${bucket}${objectPath}`
    );
  }

  private async createSignedBodyConditionImage(
    path: string
  ): Promise<BodyConditionImage> {
    const response = await this.requestStorage(
      this.getStorageObjectUrl("sign", path),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresIn: BODY_CONDITION_IMAGE_SIGNED_URL_TTL_SECONDS
        })
      },
      "create body-condition image URL"
    );

    let result: unknown;
    try {
      result = await response.json();
    } catch (error) {
      this.logger.error("Supabase Storage returned invalid signed-URL JSON.", error);
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    if (!isRecord(result) || typeof result.signedURL !== "string") {
      this.logger.error("Supabase Storage returned an unexpected signed-URL shape.");
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    const signedValue = result.signedURL;
    const isAbsoluteUrl = /^https?:\/\//i.test(signedValue);
    const signedPath = signedValue.startsWith("/storage/v1/")
      ? signedValue
      : `/storage/v1/${signedValue.replace(/^\/+/, "")}`;
    let signedUrl: URL;
    try {
      signedUrl = new URL(
        isAbsoluteUrl ? signedValue : signedPath,
        `${this.supabaseUrl}/`
      );
    } catch (error) {
      this.logger.error("Supabase Storage returned an invalid signed URL.", error);
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    const expectedPath = `/storage/v1/object/sign/${encodeURIComponent(
      this.storageBucket
    )}/${path.split("/").map(encodeURIComponent).join("/")}`;
    if (
      signedUrl.origin !== new URL(this.supabaseUrl).origin ||
      signedUrl.pathname !== expectedPath
    ) {
      this.logger.error("Supabase Storage returned a signed URL for another host.");
      throw new ServiceUnavailableException(
        "Supabase Storage returned an invalid signed-URL response."
      );
    }

    return {
      path,
      signedUrl: signedUrl.toString(),
      expiresAt: new Date(
        Date.now() + BODY_CONDITION_IMAGE_SIGNED_URL_TTL_SECONDS * 1000
      ).toISOString()
    };
  }

  private async requestStorage(
    url: URL,
    init: RequestInit,
    operation: string
  ): Promise<Response> {
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set("apikey", this.serviceRoleKey);
      headers.set("Authorization", `Bearer ${this.serviceRoleKey}`);
      headers.set("Accept", "application/json");
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(15000)
      });
    } catch (error) {
      this.logger.error(`Supabase Storage ${operation} request failed.`, error);
      throw new ServiceUnavailableException(
        "Image storage is temporarily unavailable."
      );
    }

    if (!response.ok) {
      let storageError: unknown;
      try {
        storageError = await response.json();
      } catch {
        storageError = null;
      }

      const message =
        isRecord(storageError) && typeof storageError.message === "string"
          ? storageError.message.slice(0, 300)
          : "No error message returned.";
      this.logger.error(
        `Supabase Storage ${operation} returned HTTP ${response.status}: ${message}`
      );
      throw new ServiceUnavailableException(
        "Image storage could not complete the request."
      );
    }

    return response;
  }

  private async requestSupabaseTable(
    url: URL,
    init: RequestInit,
    resource: string
  ): Promise<Response> {
    let response: Response;
    try {
      const headers = new Headers(init.headers);
      headers.set("apikey", this.serviceRoleKey);
      headers.set("Authorization", `Bearer ${this.serviceRoleKey}`);
      headers.set("Accept", "application/json");
      response = await fetch(url, {
        ...init,
        headers,
        signal: AbortSignal.timeout(10000)
      });
    } catch (error) {
      this.logger.error(`Supabase ${resource} request failed.`, error);
      throw new ServiceUnavailableException(
        `${resource} storage is temporarily unavailable.`
      );
    }

    if (!response.ok) {
      let databaseError: unknown;
      try {
        databaseError = await response.json();
      } catch {
        databaseError = null;
      }

      const code =
        isRecord(databaseError) && typeof databaseError.code === "string"
          ? databaseError.code
          : "unknown";
      const message =
        isRecord(databaseError) && typeof databaseError.message === "string"
          ? databaseError.message.slice(0, 300)
          : "No error message returned.";
      this.logger.error(
        `Supabase ${resource} request returned HTTP ${response.status} (${code}): ${message}`
      );
      throw new ServiceUnavailableException(
        `${resource} data could not be loaded or updated.`
      );
    }

    return response;
  }

  private async parseBodyConditionRows(
    response: Response
  ): Promise<SupabaseBodyConditionRow[]> {
    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error("Supabase returned invalid body-condition JSON.", error);
      throw new ServiceUnavailableException(
        "Supabase returned an invalid body-condition response."
      );
    }

    if (!Array.isArray(rows) || !rows.every(isSupabaseBodyConditionRow)) {
      this.logger.error(
        "Supabase returned an unexpected body-condition response."
      );
      throw new ServiceUnavailableException(
        "Supabase returned an invalid body-condition response."
      );
    }

    return rows;
  }

  private async parseDailyHealthCheckRows(
    response: Response
  ): Promise<SupabaseDailyHealthCheckRow[]> {
    let rows: unknown;
    try {
      rows = await response.json();
    } catch (error) {
      this.logger.error(
        "Supabase returned invalid daily health-check JSON.",
        error
      );
      throw new ServiceUnavailableException(
        "Supabase returned an invalid daily health-check response."
      );
    }

    if (!Array.isArray(rows) || !rows.every(isSupabaseDailyHealthCheckRow)) {
      this.logger.error(
        "Supabase returned an unexpected daily health-check response."
      );
      throw new ServiceUnavailableException(
        "Supabase returned an invalid daily health-check response."
      );
    }

    return rows;
  }

  async obtenerCatalogoMisiones(
    entorno?: string,
    dificultad?: string
  ): Promise<MisionCatalogo[]> {
    const url = this.getMissionsUrl();
    url.searchParams.set(
      "select",
      "id,titulo,descripcion,categoria,valor_objetivo,unidad,entorno,dificultad,activa,creado_en"
    );
    url.searchParams.set("activa", "eq.true");
    if (dificultad) {
      url.searchParams.set("dificultad", `eq.${dificultad}`);
    }
    if (entorno && entorno !== "all") {
      url.searchParams.set("or", `(entorno.eq.${entorno},entorno.eq.all)`);
    }

    try {
      const response = await this.requestSupabaseTable(
        url,
        { method: "GET" },
        "missions"
      );
      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((r: any) => mapMission(r));
      }
    } catch (err) {
      this.logger.warn(
        "No se pudo consultar la tabla missions en Supabase. Usando catálogo de respaldo.",
        err
      );
    }

    let filtradas = MISIONES_SEMILLA_POR_DEFECTO.filter((m) => m.activa);
    if (entorno && entorno !== "all") {
      filtradas = filtradas.filter(
        (m) => m.entorno === entorno || m.entorno === "all"
      );
    }
    if (dificultad) {
      filtradas = filtradas.filter((m) => m.dificultad === dificultad);
    }
    return filtradas;
  }

  async obtenerMisionesDelDia(
    usuarioId: string,
    query: ConsultarMisionesQueryDto
  ): Promise<MisionDiariaRotada[]> {
    const entorno = (query.entorno || "nave") as EntornoMision;
    const catalogo = await this.obtenerCatalogoMisiones(entorno);

    const fechaReferencia = query.fecha || new Date().toISOString().slice(0, 10);
    const partesFecha = fechaReferencia.split("-").map(Number);
    const diaNum =
      partesFecha.length === 3 && !partesFecha.some(isNaN)
        ? Math.floor(
            new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2]).getTime() /
              86400000
          )
        : Math.floor(Date.now() / 86400000);

    const cicloDificultades: DificultadMision[] = ["baja", "media", "alta"];
    const dificultadRotativa =
      query.dificultad || cicloDificultades[Math.abs(diaNum) % 3];

    // 1. Misión de Check-in
    const checkinMision =
      catalogo.find((m) => m.categoria === "checkin") ||
      MISIONES_SEMILLA_POR_DEFECTO[0];

    // 2. Misión de Pasos o Caminadora según entorno y dificultad rotada
    const categoriaActividad =
      entorno === "nave" || entorno === "estacion" ? "treadmill" : "steps";
    const candidatasPasos = catalogo.filter(
      (m) =>
        m.categoria === categoriaActividad &&
        (m.entorno === entorno || m.entorno === "all")
    );
    const misionPasos =
      candidatasPasos.find((m) => m.dificultad === dificultadRotativa) ||
      candidatasPasos[0] ||
      catalogo.find((m) => m.categoria === categoriaActividad) ||
      catalogo[2];

    // 3. Misiones de Ejercicio (2 misiones rotativas según el día)
    const candidatasEjercicio = catalogo.filter(
      (m) =>
        m.categoria === "exercise" &&
        (m.entorno === entorno || m.entorno === "all")
    );
    const ejerciciosSeleccionados: MisionCatalogo[] = [];
    if (candidatasEjercicio.length > 0) {
      const indiceBase = Math.abs(diaNum) % candidatasEjercicio.length;
      ejerciciosSeleccionados.push(candidatasEjercicio[indiceBase]);
      if (candidatasEjercicio.length > 1) {
        const segundoIndice = (indiceBase + 1) % candidatasEjercicio.length;
        ejerciciosSeleccionados.push(candidatasEjercicio[segundoIndice]);
      }
    }

    const misionesSeleccionadas: MisionCatalogo[] = [
      checkinMision,
      misionPasos,
      ...ejerciciosSeleccionados
    ];

    const pasosActuales = Number(query.pasosActuales || 0);
    const checkinRealizado =
      query.checkinRealizado === true || query.checkinRealizado === "true";
    const caminadoraActiva =
      query.caminadoraActiva === true || query.caminadoraActiva === "true";

    return misionesSeleccionadas.map((m) => {
      let valorActual = 0;
      let completada = false;

      if (m.categoria === "checkin") {
        valorActual = checkinRealizado ? 1 : 0;
        completada = checkinRealizado;
      } else if (m.categoria === "steps") {
        valorActual = pasosActuales;
        completada = pasosActuales >= m.valorObjetivo;
      } else if (m.categoria === "treadmill") {
        valorActual = caminadoraActiva ? pasosActuales : 0;
        completada = caminadoraActiva && pasosActuales >= m.valorObjetivo;
      }

      return {
        ...m,
        valorActual,
        completada,
        currentValue: valorActual,
        completed: completada
      };
    });
  }

  async obtenerEstadoMisionAstronauta(
    usuarioId: string
  ): Promise<EstadoMisionAstronauta | null> {
    const url = this.getAstronautMissionStatesUrl();
    url.searchParams.set("select", "*");
    url.searchParams.set("user_id", `eq.${usuarioId}`);
    url.searchParams.set("limit", "1");

    try {
      const response = await this.requestSupabaseTable(
        url,
        { method: "GET" },
        "astronaut mission state"
      );
      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        return mapAstronautMissionState(
          rows[0] as SupabaseAstronautMissionStateRow
        );
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo obtener el estado de misión en Supabase para el usuario ${usuarioId}`,
        err
      );
    }
    return null;
  }

  async guardarEstadoMisionAstronauta(
    usuarioId: string,
    dto: GuardarEstadoMisionDto
  ): Promise<EstadoMisionAstronauta> {
    const origen = dto.origen ?? dto.origin ?? "tierra";
    const destino = dto.destino ?? dto.destination ?? "marte";
    const fechaSalida =
      dto.fechaSalida ??
      dto.departureDate ??
      new Date().toISOString().slice(0, 10);
    const diasTotales = Number(dto.diasTotales ?? dto.totalDays ?? 210);
    const fechaLlegadaEstimada =
      dto.fechaLlegadaEstimada ??
      dto.estimatedArrivalDate ??
      new Date(Date.now() + diasTotales * 86400000).toISOString().slice(0, 10);

    const diaActual = Math.max(0, Number(dto.diaActual ?? dto.currentDay ?? 0));
    const porcentajeProgresoRelativo =
      dto.porcentajeProgresoRelativo !== undefined
        ? Number(dto.porcentajeProgresoRelativo)
        : dto.relativeProgressPct !== undefined
        ? Number(dto.relativeProgressPct)
        : Math.min(
            100,
            Math.round((diaActual / Math.max(0.01, diasTotales)) * 10000) / 100
          );

    const estado =
      dto.estado ??
      dto.status ??
      (diaActual >= diasTotales
        ? "arrived"
        : diaActual === 0
        ? "scheduled"
        : "in_transit");

    const entornoActual =
      dto.entornoActual ??
      dto.currentEnvironment ??
      (estado === "arrived" ? destino : diaActual === 0 ? origen : "nave");

    const ahora = new Date().toISOString();
    const payload = {
      user_id: usuarioId,
      origen,
      destino,
      fecha_salida: fechaSalida,
      fecha_llegada_estimada: fechaLlegadaEstimada,
      fecha_llegada_real: null,
      dias_totales: diasTotales,
      dia_actual: diaActual,
      porcentaje_progreso_relativo: porcentajeProgresoRelativo,
      entorno_actual: entornoActual,
      estado,
      llegada_anticipada: false,
      actualizado_en: ahora
    };

    const url = this.getAstronautMissionStatesUrl();
    url.searchParams.set("on_conflict", "user_id");

    try {
      const response = await this.requestSupabaseTable(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation"
          },
          body: JSON.stringify(payload)
        },
        "save astronaut mission state"
      );

      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        return mapAstronautMissionState(
          rows[0] as SupabaseAstronautMissionStateRow
        );
      }
    } catch (err) {
      this.logger.warn(
        "No se pudo guardar el estado de misión en Supabase; retornando estado local.",
        err
      );
    }

    return {
      id: randomUUID(),
      usuarioId,
      origen,
      destino,
      fechaSalida,
      fechaLlegadaEstimada,
      fechaLlegadaReal: null,
      diasTotales,
      diaActual,
      porcentajeProgresoRelativo,
      entornoActual,
      estado,
      llegadaAnticipada: false,
      creadoEn: ahora,
      actualizadoEn: ahora,
      origin: origen,
      destination: destino,
      departureDate: fechaSalida,
      estimatedArrivalDate: fechaLlegadaEstimada,
      totalDays: diasTotales,
      currentDay: diaActual,
      relativeProgressPct: porcentajeProgresoRelativo,
      currentEnvironment: entornoActual,
      status: estado,
      arrivedEarly: false
    };
  }

  async marcarLlegadaAnticipada(
    usuarioId: string,
    dto: LlegadaAnticipadaDto
  ): Promise<EstadoMisionAstronauta> {
    const estadoActual = await this.obtenerEstadoMisionAstronauta(usuarioId);
    const ahoraIso = new Date().toISOString();
    const fechaLlegadaReal =
      dto.fechaLlegadaReal ?? dto.actualArrivalDate ?? ahoraIso.slice(0, 10);

    const origen = estadoActual?.origen ?? "tierra";
    const destino = estadoActual?.destino ?? "marte";
    const diasTotales = estadoActual?.diasTotales ?? 210;
    const fechaSalida = estadoActual?.fechaSalida ?? fechaLlegadaReal;
    const fechaLlegadaEstimada =
      estadoActual?.fechaLlegadaEstimada ?? fechaLlegadaReal;

    const payload = {
      user_id: usuarioId,
      origen,
      destino,
      fecha_salida: fechaSalida,
      fecha_llegada_estimada: fechaLlegadaEstimada,
      fecha_llegada_real: fechaLlegadaReal,
      dias_totales: diasTotales,
      dia_actual: diasTotales,
      porcentaje_progreso_relativo: 100,
      entorno_actual: destino,
      estado: "arrived" as EstadoMision,
      llegada_anticipada: true,
      actualizado_en: ahoraIso
    };

    const url = this.getAstronautMissionStatesUrl();
    url.searchParams.set("on_conflict", "user_id");

    try {
      const response = await this.requestSupabaseTable(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=representation"
          },
          body: JSON.stringify(payload)
        },
        "arrive early astronaut mission state"
      );

      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        return mapAstronautMissionState(
          rows[0] as SupabaseAstronautMissionStateRow
        );
      }
    } catch (err) {
      this.logger.warn(
        "No se pudo guardar la llegada anticipada en Supabase; retornando estado local.",
        err
      );
    }

    return {
      id: estadoActual?.id ?? randomUUID(),
      usuarioId,
      origen,
      destino,
      fechaSalida,
      fechaLlegadaEstimada,
      fechaLlegadaReal,
      diasTotales,
      diaActual: diasTotales,
      porcentajeProgresoRelativo: 100,
      entornoActual: destino,
      estado: "arrived",
      llegadaAnticipada: true,
      creadoEn: estadoActual?.creadoEn ?? ahoraIso,
      actualizadoEn: ahoraIso,
      origin: origen,
      destination: destino,
      departureDate: fechaSalida,
      estimatedArrivalDate: fechaLlegadaEstimada,
      actualArrivalDate: fechaLlegadaReal,
      totalDays: diasTotales,
      currentDay: diasTotales,
      relativeProgressPct: 100,
      currentEnvironment: destino,
      status: "arrived",
      arrivedEarly: true
    };
  }

  private getMissionsUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/missions`);
  }

  private getAstronautMissionStatesUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/astronaut_mission_states`);
  }
}
