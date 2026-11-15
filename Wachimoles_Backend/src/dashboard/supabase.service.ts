import {
  BadRequestException,
  NotFoundException,
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
  EstadoMisionAstronauta,
  UbicacionEntorno,
  UbicacionAstronauta,
  SupabaseAstronautLocationRow,
  MisionDiariaProgreso,
  ResumenDiaMisiones,
  RachaAstronauta,
  RespuestaProgresoMisiones,
  SupabaseDailyMissionCompletionRow,
  SupabaseDailyMissionDayRow,
  SupabaseAstronautStreakRow
} from "./dashboard.types";
import { SaveDailyHealthCheckDto } from "./daily-health-checks.dto";
import { SaveBodyConditionDto } from "./body-conditions.dto";
import {
  ConsultarMisionesQueryDto,
  SincronizarProgresoMisionesDto,
  ActualizarItemMisionDto,
  ItemProgresoMisionDto
} from "./missions.dto";
import {
  GuardarEstadoMisionDto,
  LlegadaAnticipadaDto,
  GuardarUbicacionAstronautaDto
} from "./astronaut-mission.dto";

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

export function normalizarEntorno(entorno?: string): "earth" | "spaceship" | "station" | "moon" | "mars" {
  const e = (entorno || "").toLowerCase().trim();
  if (e === "tierra" || e === "earth") return "earth";
  if (e === "nave" || e === "spaceship" || e === "ship") return "spaceship";
  if (e === "estacion" || e === "station") return "station";
  if (e === "luna" || e === "moon") return "moon";
  if (e === "marte" || e === "mars") return "mars";
  return "earth";
}

export function normalizarDificultad(dif?: string): "low" | "medium" | "high" {
  const d = (dif || "").toLowerCase().trim();
  if (d === "baja" || d === "low") return "low";
  if (d === "media" || d === "medium") return "medium";
  if (d === "alta" || d === "high") return "high";
  return "low";
}

export function entornosEquivalentes(entorno: string): string[] {
  const norm = normalizarEntorno(entorno);
  switch (norm) {
    case "earth": return ["earth", "tierra"];
    case "spaceship": return ["spaceship", "nave", "ship"];
    case "station": return ["station", "estacion"];
    case "moon": return ["moon", "luna"];
    case "mars": return ["mars", "marte"];
  }
}

export function dificultadesEquivalentes(dif: string): string[] {
  const norm = normalizarDificultad(dif);
  switch (norm) {
    case "low": return ["low", "baja"];
    case "medium": return ["medium", "media"];
    case "high": return ["high", "alta"];
  }
}

const CONFIG_ENTORNOS: Record<
  string,
  { etiqueta: string; gravedadEtiqueta: string }
> = {
  // English keys
  earth: {
    etiqueta: "On Earth (Base)",
    gravedadEtiqueta: "1.0g Earth Gravity"
  },
  spaceship: {
    etiqueta: "In Spaceship (Orbit)",
    gravedadEtiqueta: "0g Microgravity"
  },
  station: {
    etiqueta: "Space Station (ISS)",
    gravedadEtiqueta: "0g Microgravity"
  },
  moon: {
    etiqueta: "Lunar Base",
    gravedadEtiqueta: "0.16g Lunar Gravity"
  },
  mars: {
    etiqueta: "Mars Surface",
    gravedadEtiqueta: "0.38g Martian Gravity"
  },
  // Spanish aliases
  tierra: {
    etiqueta: "On Earth (Base)",
    gravedadEtiqueta: "1.0g Earth Gravity"
  },
  nave: {
    etiqueta: "In Spaceship (Orbit)",
    gravedadEtiqueta: "0g Microgravity"
  },
  estacion: {
    etiqueta: "Space Station (ISS)",
    gravedadEtiqueta: "0g Microgravity"
  },
  luna: {
    etiqueta: "Lunar Base",
    gravedadEtiqueta: "0.16g Lunar Gravity"
  },
  marte: {
    etiqueta: "Mars Surface",
    gravedadEtiqueta: "0.38g Martian Gravity"
  }
};

function mapAstronautLocation(
  row: SupabaseAstronautLocationRow
): UbicacionAstronauta {
  const rawEntorno = (row.entorno || "earth") as UbicacionEntorno;
  const config = CONFIG_ENTORNOS[rawEntorno] ?? CONFIG_ENTORNOS.earth;
  const ahoraIso = new Date().toISOString();
  const actualizadoEn = row.actualizado_en ?? ahoraIso;

  return {
    usuarioId: row.user_id,
    entorno: rawEntorno,
    etiqueta: config.etiqueta,
    gravedadEtiqueta: config.gravedadEtiqueta,
    actualizadoEn,
    userId: row.user_id,
    environment: rawEntorno,
    label: config.etiqueta,
    gravityLabel: config.gravedadEtiqueta,
    updatedAt: actualizadoEn
  };
}

function calcularDiferenciaDias(fechaReciente: string, fechaAnterior: string): number {
  const d1 = new Date(fechaReciente + "T00:00:00Z").getTime();
  const d2 = new Date(fechaAnterior + "T00:00:00Z").getTime();
  return Math.round((d1 - d2) / 86400000);
}

function mapAstronautStreak(
  row: SupabaseAstronautStreakRow,
  fechaHoy?: string
): RachaAstronauta {
  const ahoraIso = new Date().toISOString();
  const hoy = fechaHoy ?? ahoraIso.slice(0, 10);
  const rachaActual = Math.max(0, Number(row.racha_actual || 0));
  const rachaMaxima = Math.max(rachaActual, Number(row.racha_maxima || 0));
  const totalDias = Math.max(0, Number(row.total_dias_completados || 0));
  const ultimaFecha = row.ultima_fecha_completada ?? null;
  const todasCompletadasHoy = ultimaFecha === hoy;
  const actualizadoEn = row.actualizado_en ?? ahoraIso;

  return {
    usuarioId: row.user_id,
    rachaActual,
    rachaMaxima,
    totalDiasCompletados: totalDias,
    ultimaFechaCompletada: ultimaFecha,
    todasCompletadasHoy,
    actualizadoEn,
    userId: row.user_id,
    currentStreak: rachaActual,
    maxStreak: rachaMaxima,
    totalCompletedDays: totalDias,
    lastCompletedDate: ultimaFecha,
    allCompletedToday: todasCompletadasHoy,
    updatedAt: actualizadoEn
  };
}

function mapDailyMissionCompletion(
  row: SupabaseDailyMissionCompletionRow
): MisionDiariaProgreso {
  const valorActual = Number(row.valor_actual || 0);
  const valorObjetivo = Number(row.valor_objetivo || 1);
  const completada = Boolean(row.completada);

  return {
    misionId: row.mision_id,
    completada,
    valorActual,
    valorObjetivo,
    actualizadoEn: row.actualizado_en,
    missionId: row.mision_id,
    completed: completada,
    currentValue: valorActual,
    targetValue: valorObjetivo
  };
}

function mapDailyMissionDay(
  row: SupabaseDailyMissionDayRow
): ResumenDiaMisiones {
  const total = Number(row.total_misiones || 0);
  const completadas = Number(row.misiones_completadas || 0);
  const todas = Boolean(row.todas_completadas);
  const punto = Boolean(row.punto_racha_otorgado);

  return {
    fecha: row.fecha,
    totalMisiones: total,
    misionesCompletadas: completadas,
    todasCompletadas: todas,
    puntoRachaOtorgado: punto,
    actualizadoEn: row.actualizado_en,
    date: row.fecha,
    totalMissions: total,
    completedMissions: completadas,
    allCompleted: todas,
    streakPointAwarded: punto
  };
}

const MISIONES_SEMILLA_POR_DEFECTO: MisionCatalogo[] = [
  {
    id: "daily-checkin",
    titulo: "Daily medical check-in",
    descripcion: "Confirm overall physical condition, vital signs, and daily questionnaire to sustain health streak.",
    categoria: "checkin",
    valorObjetivo: 1,
    unidad: "check",
    entorno: "all",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Daily medical check-in",
    description: "Confirm overall physical condition, vital signs, and daily questionnaire to sustain health streak.",
    category: "checkin",
    targetValue: 1,
    unit: "check",
    environment: "all",
    difficulty: "low"
  },
  {
    id: "injury-check",
    titulo: "Pain area photographic inspection",
    descripcion: "Capture visual log of muscle inflammation, bruising, or skin condition.",
    categoria: "injury_check",
    valorObjetivo: 1,
    unidad: "check",
    entorno: "all",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Pain area photographic inspection",
    description: "Capture visual log of muscle inflammation, bruising, or skin condition.",
    category: "injury_check",
    targetValue: 1,
    unit: "check",
    environment: "all",
    difficulty: "medium"
  },
  {
    id: "earth-steps-low",
    titulo: "Light conditioning walk",
    descripcion: "Gentle day: regenerative walking pace and basic cardiovascular reactivation.",
    categoria: "steps",
    valorObjetivo: 3500,
    unidad: "steps",
    entorno: "earth",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Light conditioning walk",
    description: "Gentle day: regenerative walking pace and basic cardiovascular reactivation.",
    category: "steps",
    targetValue: 3500,
    unit: "steps",
    environment: "earth",
    difficulty: "low"
  },
  {
    id: "earth-steps-medium",
    titulo: "Base standard step goal",
    descripcion: "Moderate day: maintain muscle tone and systemic circulation under 1.0g.",
    categoria: "steps",
    valorObjetivo: 7000,
    unidad: "steps",
    entorno: "earth",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Base standard step goal",
    description: "Moderate day: maintain muscle tone and systemic circulation under 1.0g.",
    category: "steps",
    targetValue: 7000,
    unit: "steps",
    environment: "earth",
    difficulty: "medium"
  },
  {
    id: "earth-steps-high",
    titulo: "High-resistance Earth march",
    descripcion: "Intense day: high-demand cardiovascular conditioning and aerobic threshold.",
    categoria: "steps",
    valorObjetivo: 11000,
    unidad: "steps",
    entorno: "earth",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "High-resistance Earth march",
    description: "Intense day: high-demand cardiovascular conditioning and aerobic threshold.",
    category: "steps",
    targetValue: 11000,
    unit: "steps",
    environment: "earth",
    difficulty: "high"
  },
  {
    id: "earth-core-low",
    titulo: "Joint mobility & core stretching",
    descripcion: "Gentle routine for spinal decompression and axial flexibility.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "earth",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Joint mobility & core stretching",
    description: "Gentle routine for spinal decompression and axial flexibility.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "earth",
    difficulty: "low"
  },
  {
    id: "earth-cardio-medium",
    titulo: "1.0g aerobic conditioning",
    descripcion: "Moderate cardiovascular routine for muscular endurance and VO2 maintenance.",
    categoria: "exercise",
    valorObjetivo: 30,
    unidad: "min",
    entorno: "earth",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "1.0g aerobic conditioning",
    description: "Moderate cardiovascular routine for muscular endurance and VO2 maintenance.",
    category: "exercise",
    targetValue: 30,
    unit: "min",
    environment: "earth",
    difficulty: "medium"
  },
  {
    id: "earth-strength-high",
    titulo: "Maximum load strength training",
    descripcion: "Demanding functional strength session for muscular power and motor readaptation.",
    categoria: "exercise",
    valorObjetivo: 45,
    unidad: "min",
    entorno: "earth",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Maximum load strength training",
    description: "Demanding functional strength session for muscular power and motor readaptation.",
    category: "exercise",
    targetValue: 45,
    unit: "min",
    environment: "earth",
    difficulty: "high"
  },
  {
    id: "spaceship-treadmill-low",
    titulo: "T2 Treadmill in 0g: gentle stride",
    descripcion: "Gentle day: light session with harness bungee loading to prevent deep vein thrombosis.",
    categoria: "treadmill",
    valorObjetivo: 2500,
    unidad: "steps",
    entorno: "spaceship",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "T2 Treadmill in 0g: gentle stride",
    description: "Gentle day: light session with harness bungee loading to prevent deep vein thrombosis.",
    category: "treadmill",
    targetValue: 2500,
    unit: "steps",
    environment: "spaceship",
    difficulty: "low"
  },
  {
    id: "spaceship-treadmill-medium",
    titulo: "T2 Treadmill in 0g: standard loading",
    descripcion: "Moderate day: controlled impact against bungee harness to curb bone demineralization.",
    categoria: "treadmill",
    valorObjetivo: 4500,
    unidad: "steps",
    entorno: "spaceship",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "T2 Treadmill in 0g: standard loading",
    description: "Moderate day: controlled impact against bungee harness to curb bone demineralization.",
    category: "treadmill",
    targetValue: 4500,
    unit: "steps",
    environment: "spaceship",
    difficulty: "medium"
  },
  {
    id: "spaceship-treadmill-high",
    titulo: "T2 Treadmill in 0g: high-load simulation",
    descripcion: "Demanding day: rapid cadence to challenge cardiovascular system and cortical bone density.",
    categoria: "treadmill",
    valorObjetivo: 7500,
    unidad: "steps",
    entorno: "spaceship",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "T2 Treadmill in 0g: high-load simulation",
    description: "Demanding day: rapid cadence to challenge cardiovascular system and cortical bone density.",
    category: "treadmill",
    targetValue: 7500,
    unit: "steps",
    environment: "spaceship",
    difficulty: "high"
  },
  {
    id: "spaceship-stretch-low",
    titulo: "Cabin spinal decompression",
    descripcion: "Gentle lumbar and cervical stretching to manage 0g spinal elongation.",
    categoria: "exercise",
    valorObjetivo: 10,
    unidad: "min",
    entorno: "spaceship",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Cabin spinal decompression",
    description: "Gentle lumbar and cervical stretching to manage 0g spinal elongation.",
    category: "exercise",
    targetValue: 10,
    unit: "min",
    environment: "spaceship",
    difficulty: "low"
  },
  {
    id: "spaceship-ared-medium",
    titulo: "Moderate ARED resistive routine",
    descripcion: "Piston-driven vacuum resistance exercises targeting quadriceps and posterior chain.",
    categoria: "exercise",
    valorObjetivo: 25,
    unidad: "min",
    entorno: "spaceship",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Moderate ARED resistive routine",
    description: "Piston-driven vacuum resistance exercises targeting quadriceps and posterior chain.",
    category: "exercise",
    targetValue: 25,
    unit: "min",
    environment: "spaceship",
    difficulty: "medium"
  },
  {
    id: "spaceship-ared-high",
    titulo: "Intensive ARED resistance protocol",
    descripcion: "High-load hypertrophy and axial loading protocol against severe microgravity atrophy.",
    categoria: "exercise",
    valorObjetivo: 40,
    unidad: "min",
    entorno: "spaceship",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Intensive ARED resistance protocol",
    description: "High-load hypertrophy and axial loading protocol against severe microgravity atrophy.",
    category: "exercise",
    targetValue: 40,
    unit: "min",
    environment: "spaceship",
    difficulty: "high"
  },
  {
    id: "station-treadmill-low",
    titulo: "ISS T2 Treadmill: recovery jog",
    descripcion: "Brief vibration-isolated session in service module for limb perfusion.",
    categoria: "treadmill",
    valorObjetivo: 3000,
    unidad: "steps",
    entorno: "station",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "ISS T2 Treadmill: recovery jog",
    description: "Brief vibration-isolated session in service module for limb perfusion.",
    category: "treadmill",
    targetValue: 3000,
    unit: "steps",
    environment: "station",
    difficulty: "low"
  },
  {
    id: "station-treadmill-medium",
    titulo: "ISS T2 Treadmill: orbital standard",
    descripcion: "Daily protocol to preserve caloric expenditure and postural stability in 0g.",
    categoria: "treadmill",
    valorObjetivo: 5000,
    unidad: "steps",
    entorno: "station",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "ISS T2 Treadmill: orbital standard",
    description: "Daily protocol to preserve caloric expenditure and postural stability in 0g.",
    category: "treadmill",
    targetValue: 5000,
    unit: "steps",
    environment: "station",
    difficulty: "medium"
  },
  {
    id: "station-treadmill-high",
    titulo: "ISS T2 Treadmill: intensive protocol",
    descripcion: "High-speed interval training with elevated harness resistance.",
    categoria: "treadmill",
    valorObjetivo: 8000,
    unidad: "steps",
    entorno: "station",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "ISS T2 Treadmill: intensive protocol",
    description: "High-speed interval training with elevated harness resistance.",
    category: "treadmill",
    targetValue: 8000,
    unit: "steps",
    environment: "station",
    difficulty: "high"
  },
  {
    id: "station-sans-low",
    titulo: "Cephalic control & SANS visual pause",
    descripcion: "Optic nerve relaxation and intracranial fluid pressure relief in microgravity.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "station",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Cephalic control & SANS visual pause",
    description: "Optic nerve relaxation and intracranial fluid pressure relief in microgravity.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "station",
    difficulty: "low"
  },
  {
    id: "station-ared-medium",
    titulo: "Orbital module ARED resistance",
    descripcion: "Targeted skeletal compression on lower extremities and scapular girdle.",
    categoria: "exercise",
    valorObjetivo: 25,
    unidad: "min",
    entorno: "station",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Orbital module ARED resistance",
    description: "Targeted skeletal compression on lower extremities and scapular girdle.",
    category: "exercise",
    targetValue: 25,
    unit: "min",
    environment: "station",
    difficulty: "medium"
  },
  {
    id: "station-fuerza-alta",
    titulo: "Peak ARED loading & isometric work",
    descripcion: "Strict protocol simulating terrestrial 1g forces on core muscle groups.",
    categoria: "exercise",
    valorObjetivo: 45,
    unidad: "min",
    entorno: "station",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Peak ARED loading & isometric work",
    description: "Strict protocol simulating terrestrial 1g forces on core muscle groups.",
    category: "exercise",
    targetValue: 45,
    unit: "min",
    environment: "station",
    difficulty: "high"
  },
  {
    id: "moon-steps-low",
    titulo: "Short patrol on lunar regolith",
    descripcion: "Gentle day: scouting walk in reduced 0.16g traction terrain.",
    categoria: "steps",
    valorObjetivo: 4000,
    unidad: "steps",
    entorno: "moon",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Short patrol on lunar regolith",
    description: "Gentle day: scouting walk in reduced 0.16g traction terrain.",
    category: "steps",
    targetValue: 4000,
    unit: "steps",
    environment: "moon",
    difficulty: "low"
  },
  {
    id: "moon-steps-medium",
    titulo: "Standard lunar exploration march",
    descripcion: "Moderate day: traverse between surface domes and cargo logistics modules.",
    categoria: "steps",
    valorObjetivo: 6500,
    unidad: "steps",
    entorno: "moon",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Standard lunar exploration march",
    description: "Moderate day: traverse between surface domes and cargo logistics modules.",
    category: "steps",
    targetValue: 6500,
    unit: "steps",
    environment: "moon",
    difficulty: "medium"
  },
  {
    id: "moon-steps-high",
    titulo: "Extended lunar surface expedition",
    descripcion: "Intense day: crater navigation under pressurized spacesuit mass.",
    categoria: "steps",
    valorObjetivo: 9500,
    unidad: "steps",
    entorno: "moon",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Extended lunar surface expedition",
    description: "Intense day: crater navigation under pressurized spacesuit mass.",
    category: "steps",
    targetValue: 9500,
    unit: "steps",
    environment: "moon",
    difficulty: "high"
  },
  {
    id: "moon-balance-low",
    titulo: "Postural control & ankle stability",
    descripcion: "Proprioception recovery in 0.16g following EVA boot traverse.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "moon",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Postural control & ankle stability",
    description: "Proprioception recovery in 0.16g following EVA boot traverse.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "moon",
    difficulty: "low"
  },
  {
    id: "moon-eva-media",
    titulo: "Post-EVA joint mobility & relief",
    descripcion: "Tendon and deltoid decompression after rigid spacesuit load bearing.",
    categoria: "exercise",
    valorObjetivo: 25,
    unidad: "min",
    entorno: "moon",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Post-EVA joint mobility & relief",
    description: "Tendon and deltoid decompression after rigid spacesuit load bearing.",
    category: "exercise",
    targetValue: 25,
    unit: "min",
    environment: "moon",
    difficulty: "medium"
  },
  {
    id: "moon-load-high",
    titulo: "Functional strength in low gravity",
    descripcion: "Power squats and lumbar stabilization against loose lunar regolith.",
    categoria: "exercise",
    valorObjetivo: 40,
    unidad: "min",
    entorno: "moon",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Functional strength in low gravity",
    description: "Power squats and lumbar stabilization against loose lunar regolith.",
    category: "exercise",
    targetValue: 40,
    unit: "min",
    environment: "moon",
    difficulty: "high"
  },
  {
    id: "mars-steps-low",
    titulo: "Martian habitat acclimatization",
    descripcion: "Gentle day: interior rounds and biological adjustment to 0.38g.",
    categoria: "steps",
    valorObjetivo: 5000,
    unidad: "steps",
    entorno: "mars",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Martian habitat acclimatization",
    description: "Gentle day: interior rounds and biological adjustment to 0.38g.",
    category: "steps",
    targetValue: 5000,
    unit: "steps",
    environment: "mars",
    difficulty: "low"
  },
  {
    id: "mars-steps-medium",
    titulo: "Martian surface sample survey",
    descripcion: "Moderate day: geological field trek with steady cadence over dune fields.",
    categoria: "steps",
    valorObjetivo: 8500,
    unidad: "steps",
    entorno: "mars",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Martian surface sample survey",
    description: "Moderate day: geological field trek with steady cadence over dune fields.",
    category: "steps",
    targetValue: 8500,
    unit: "steps",
    environment: "mars",
    difficulty: "medium"
  },
  {
    id: "mars-steps-high",
    titulo: "Extreme trek on rocky Martian terrain",
    descripcion: "High-demand trek across steep crater inclines and basaltic terrain.",
    categoria: "steps",
    valorObjetivo: 12000,
    unidad: "steps",
    entorno: "mars",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Extreme trek on rocky Martian terrain",
    description: "High-demand trek across steep crater inclines and basaltic terrain.",
    category: "steps",
    targetValue: 12000,
    unit: "steps",
    environment: "mars",
    difficulty: "high"
  },
  {
    id: "mars-breathing-low",
    titulo: "Diaphragmatic breathing & SpO2 check",
    descripcion: "Airway clearing and guided airlock pulmonary ventilation routine.",
    categoria: "exercise",
    valorObjetivo: 15,
    unidad: "min",
    entorno: "mars",
    dificultad: "low",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Diaphragmatic breathing & SpO2 check",
    description: "Airway clearing and guided airlock pulmonary ventilation routine.",
    category: "exercise",
    targetValue: 15,
    unit: "min",
    environment: "mars",
    difficulty: "low"
  },
  {
    id: "mars-load-medium",
    titulo: "0.38g load-bearing conditioning",
    descripcion: "Erector spinae and quadriceps reinforcement for Martian gravity field.",
    categoria: "exercise",
    valorObjetivo: 30,
    unidad: "min",
    entorno: "mars",
    dificultad: "medium",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "0.38g load-bearing conditioning",
    description: "Erector spinae and quadriceps reinforcement for Martian gravity field.",
    category: "exercise",
    targetValue: 30,
    unit: "min",
    environment: "mars",
    difficulty: "medium"
  },
  {
    id: "mars-load-high",
    titulo: "Extreme muscular overload & power",
    descripcion: "Advanced power protocol for heavy equipment portage on rough terrain.",
    categoria: "exercise",
    valorObjetivo: 45,
    unidad: "min",
    entorno: "mars",
    dificultad: "high",
    activa: true,
    creadoEn: "2026-11-14T00:00:00.000Z",
    title: "Extreme muscular overload & power",
    description: "Advanced power protocol for heavy equipment portage on rough terrain.",
    category: "exercise",
    targetValue: 45,
    unit: "min",
    environment: "mars",
    difficulty: "high"
  }
];@Injectable()
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

  async getHealthAlerts(userId: string, audience: "mobile" | "monitor") {
    const ackColumn = audience === "mobile" ? "mobile_acknowledged_at" : "monitor_acknowledged_at";
    const url = new URL(`${this.supabaseUrl}/rest/v1/health_alerts`);
    url.searchParams.set("select", `id,user_id,rule,severity,muscle_id,muscle_name,value,threshold,created_at,updated_at,resolved_at,${ackColumn}`);
    url.searchParams.set("user_id", `eq.${userId}`);
    // Keep every open episode, even when the resolved history is large.
    url.searchParams.set("order", "resolved_at.desc.nullsfirst,created_at.desc,id.desc");
    url.searchParams.set("limit", "500");
    const response = await this.requestSupabaseTable(url, { method: "GET" }, "health alerts");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || !rows.every(row => isRecord(row) &&
      typeof row.id === "string" && row.user_id === userId &&
      (row.rule === "pain_threshold" || row.rule === "active_problems") &&
      (row.severity === "critical" || row.severity === "warning") &&
      typeof row.value === "number" && typeof row.threshold === "number" &&
      typeof row.created_at === "string" && typeof row.updated_at === "string")) {
      throw new ServiceUnavailableException("Invalid health alerts data.");
    }
    return rows.map(row => ({
      id: row.id as string, astronautId: row.user_id as string,
      rule: row.rule as "pain_threshold" | "active_problems",
      severity: row.severity as "critical" | "warning",
      muscleId: row.muscle_id as string | null, muscleName: row.muscle_name as string | null,
      value: row.value as number, threshold: row.threshold as number,
      createdAt: row.created_at as string, updatedAt: row.updated_at as string,
      resolvedAt: row.resolved_at as string | null, acknowledgedAt: row[ackColumn] as string | null
    }));
  }

  async acknowledgeHealthAlert(userId: string, audience: "mobile" | "monitor", id: string) {
    const column = audience === "mobile" ? "mobile_acknowledged_at" : "monitor_acknowledged_at";
    const url = new URL(`${this.supabaseUrl}/rest/v1/health_alerts`);
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("id", `eq.${id}`);
    url.searchParams.set("select", "id");
    // First acknowledgement wins; repeated requests are harmless.
    url.searchParams.set(column, "is.null");
    const response = await this.requestSupabaseTable(url, {
      method: "PATCH", headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ [column]: new Date().toISOString() })
    }, "health alert acknowledgement");
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new ServiceUnavailableException("Invalid acknowledgement response.");
    if (!rows.length) {
      url.searchParams.delete(column);
      const existing = await this.requestSupabaseTable(url, { method: "GET" }, "health alert");
      const found: unknown = await existing.json();
      if (!Array.isArray(found)) throw new ServiceUnavailableException("Invalid health alert response.");
      if (!found.length) throw new NotFoundException("Health alert not found.");
    }
    return { acknowledged: true as const };
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
      if (url.pathname.endsWith("/health_alerts") && (code === "PGRST205" || code === "42P01")) {
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: "HEALTH_ALERTS_NOT_READY",
          message: "Health alerts are not configured on the server."
        });
      }
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

    const equivEntorno = entorno && entorno !== "all" ? entornosEquivalentes(entorno) : [];
    const equivDificultad = dificultad ? dificultadesEquivalentes(dificultad) : [];

    if (equivDificultad.length > 0) {
      if (equivDificultad.length === 1) {
        url.searchParams.set("dificultad", `eq.${equivDificultad[0]}`);
      } else {
        url.searchParams.set("dificultad", `in.(${equivDificultad.join(",")})`);
      }
    }
    if (equivEntorno.length > 0) {
      const orConditions = equivEntorno.map((e) => `entorno.eq.${e}`).concat("entorno.eq.all");
      url.searchParams.set("or", `(${orConditions.join(",")})`);
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
        "Could not query the missions table in Supabase. Using fallback catalog.",
        err
      );
    }

    let filtradas = MISIONES_SEMILLA_POR_DEFECTO.filter((m) => m.activa);
    if (entorno && entorno !== "all") {
      const equivs = entornosEquivalentes(entorno);
      filtradas = filtradas.filter(
        (m) => equivs.includes(m.entorno) || m.entorno === "all"
      );
    }
    if (dificultad) {
      const equivs = dificultadesEquivalentes(dificultad);
      filtradas = filtradas.filter((m) => equivs.includes(m.dificultad));
    }
    return filtradas;
  }

  async obtenerMisionesDelDia(
    usuarioId: string,
    query: ConsultarMisionesQueryDto
  ): Promise<MisionDiariaRotada[]> {
    const rawEntorno = query.environment || query.entorno || "spaceship";
    const entornoNorm = normalizarEntorno(rawEntorno);
    const equivs = entornosEquivalentes(entornoNorm);
    const catalogo = await this.obtenerCatalogoMisiones(entornoNorm);

    const fechaReferencia = query.date || query.fecha || new Date().toISOString().slice(0, 10);
    const partesFecha = fechaReferencia.split("-").map(Number);
    const diaNum =
      partesFecha.length === 3 && !partesFecha.some(isNaN)
        ? Math.floor(
          new Date(partesFecha[0], partesFecha[1] - 1, partesFecha[2]).getTime() /
          86400000
        )
        : Math.floor(Date.now() / 86400000);

    const cicloDificultades: DificultadMision[] = ["low", "medium", "high"];
    const rawDificultad = query.difficulty || query.dificultad;
    const dificultadRotativa = rawDificultad
      ? normalizarDificultad(rawDificultad)
      : cicloDificultades[Math.abs(diaNum) % 3];
    const dificultadEquivs = dificultadesEquivalentes(dificultadRotativa);

    // 1. Misión de Check-in
    const checkinMision =
      catalogo.find((m) => m.categoria === "checkin") ||
      MISIONES_SEMILLA_POR_DEFECTO[0];

    // 2. Misión de Pasos o Caminadora según entorno y dificultad rotada
    const categoriaActividad =
      entornoNorm === "spaceship" || entornoNorm === "station" ? "treadmill" : "steps";
    const candidatasPasos = catalogo.filter(
      (m) =>
        m.categoria === categoriaActividad &&
        (equivs.includes(m.entorno) || m.entorno === "all")
    );
    const misionPasos =
      candidatasPasos.find((m) => dificultadEquivs.includes(m.dificultad)) ||
      candidatasPasos[0] ||
      catalogo.find((m) => m.categoria === categoriaActividad) ||
      catalogo[2];

    // 3. Misiones de Ejercicio (2 misiones rotativas según el día)
    const candidatasEjercicio = catalogo.filter(
      (m) =>
        m.categoria === "exercise" &&
        (equivs.includes(m.entorno) || m.entorno === "all")
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

    const pasosActuales = Number(query.currentSteps ?? query.pasosActuales ?? 0);
    const checkinRealizado =
      query.checkinRealizado === true || query.checkinRealizado === "true";
    const caminadoraActiva =
      query.caminadoraActiva === true || query.caminadoraActiva === "true";
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
        `Could not fetch the mission state in Supabase for user ${usuarioId}`,
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
        "Could not save the mission state in Supabase; returning local state.",
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

  private getAstronautLocationsUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/astronaut_locations`);
  }

  async obtenerUbicacionActualAstronauta(
    usuarioId: string
  ): Promise<UbicacionAstronauta> {
    const url = this.getAstronautLocationsUrl();
    url.searchParams.set("select", "*");
    url.searchParams.set("user_id", `eq.${usuarioId}`);
    url.searchParams.set("limit", "1");

    try {
      const response = await this.requestSupabaseTable(
        url,
        { method: "GET" },
        "astronaut current location"
      );
      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        return mapAstronautLocation(rows[0] as SupabaseAstronautLocationRow);
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch the current location in Supabase for user ${usuarioId}`,
        err
      );
    }

    // Fallback: si no hay registro en astronaut_locations, revisar si existe estado de misión
    const estadoMision = await this.obtenerEstadoMisionAstronauta(usuarioId);
    if (estadoMision?.entornoActual) {
      const config = CONFIG_ENTORNOS[estadoMision.entornoActual] ?? CONFIG_ENTORNOS.tierra;
      return {
        usuarioId,
        entorno: estadoMision.entornoActual,
        etiqueta: config.etiqueta,
        gravedadEtiqueta: config.gravedadEtiqueta,
        actualizadoEn: estadoMision.actualizadoEn,
        userId: usuarioId,
        environment: estadoMision.entornoActual,
        label: config.etiqueta,
        gravityLabel: config.gravedadEtiqueta,
        updatedAt: estadoMision.actualizadoEn
      };
    }

    const configDefault = CONFIG_ENTORNOS.tierra;
    const ahoraIso = new Date().toISOString();
    return {
      usuarioId,
      entorno: "tierra",
      etiqueta: configDefault.etiqueta,
      gravedadEtiqueta: configDefault.gravedadEtiqueta,
      actualizadoEn: ahoraIso,
      userId: usuarioId,
      environment: "tierra",
      label: configDefault.etiqueta,
      gravityLabel: configDefault.gravedadEtiqueta,
      updatedAt: ahoraIso
    };
  }

  async guardarUbicacionActualAstronauta(
    usuarioId: string,
    dto: GuardarUbicacionAstronautaDto
  ): Promise<UbicacionAstronauta> {
    const entorno: UbicacionEntorno = dto.entorno ?? dto.environment ?? "tierra";
    const config = CONFIG_ENTORNOS[entorno] ?? CONFIG_ENTORNOS.tierra;
    const ahoraIso = new Date().toISOString();

    const payload = {
      user_id: usuarioId,
      entorno,
      actualizado_en: ahoraIso
    };

    const url = this.getAstronautLocationsUrl();
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
        "save astronaut current location"
      );

      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        void this.actualizarEntornoEnEstadoMisionSiExiste(usuarioId, entorno);
        return mapAstronautLocation(rows[0] as SupabaseAstronautLocationRow);
      }
    } catch (err) {
      this.logger.warn(
        "Could not save the location in Supabase; returning local state.",
        err
      );
    }

    void this.actualizarEntornoEnEstadoMisionSiExiste(usuarioId, entorno);

    return {
      usuarioId,
      entorno,
      etiqueta: config.etiqueta,
      gravedadEtiqueta: config.gravedadEtiqueta,
      actualizadoEn: ahoraIso,
      userId: usuarioId,
      environment: entorno,
      label: config.etiqueta,
      gravityLabel: config.gravedadEtiqueta,
      updatedAt: ahoraIso
    };
  }

  private async actualizarEntornoEnEstadoMisionSiExiste(
    usuarioId: string,
    entorno: UbicacionEntorno
  ): Promise<void> {
    try {
      const estado = await this.obtenerEstadoMisionAstronauta(usuarioId);
      if (estado) {
        const url = this.getAstronautMissionStatesUrl();
        url.searchParams.set("user_id", `eq.${usuarioId}`);
        await this.requestSupabaseTable(
          url,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Prefer: "return=minimal"
            },
            body: JSON.stringify({
              entorno_actual: entorno,
              actualizado_en: new Date().toISOString()
            })
          },
          "sync environment to astronaut mission states"
        );
      }
    } catch {
      // Ignorar fallas secundarias al actualizar astronaut_mission_states
    }
  }

  private getDailyMissionCompletionsUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/daily_mission_completions`);
  }

  private getDailyMissionDaysUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/daily_mission_days`);
  }

  private getAstronautStreaksUrl(): URL {
    return new URL(`${this.supabaseUrl}/rest/v1/astronaut_streaks`);
  }

  async obtenerRachaAstronauta(usuarioId: string): Promise<RachaAstronauta> {
    const url = this.getAstronautStreaksUrl();
    url.searchParams.set("select", "*");
    url.searchParams.set("user_id", `eq.${usuarioId}`);
    url.searchParams.set("limit", "1");

    try {
      const response = await this.requestSupabaseTable(
        url,
        { method: "GET" },
        "astronaut streak"
      );
      const rows = (await response.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        return mapAstronautStreak(rows[0] as SupabaseAstronautStreakRow);
      }
    } catch (err) {
      this.logger.warn(
        `No se pudo obtener la racha en Supabase para el usuario ${usuarioId}`,
        err
      );
    }

    const ahoraIso = new Date().toISOString();
    return {
      usuarioId,
      rachaActual: 0,
      rachaMaxima: 0,
      totalDiasCompletados: 0,
      ultimaFechaCompletada: null,
      todasCompletadasHoy: false,
      actualizadoEn: ahoraIso,
      userId: usuarioId,
      currentStreak: 0,
      maxStreak: 0,
      totalCompletedDays: 0,
      lastCompletedDate: null,
      allCompletedToday: false,
      updatedAt: ahoraIso
    };
  }

  async obtenerProgresoMisionesDelDia(
    usuarioId: string,
    fecha?: string
  ): Promise<{
    resumen: ResumenDiaMisiones | null;
    misiones: MisionDiariaProgreso[];
    racha: RachaAstronauta;
  }> {
    const fechaConsulta = fecha ?? new Date().toISOString().slice(0, 10);
    const racha = await this.obtenerRachaAstronauta(usuarioId);

    let resumen: ResumenDiaMisiones | null = null;
    const misiones: MisionDiariaProgreso[] = [];

    // 1. Consultar resumen del día
    try {
      const urlDia = this.getDailyMissionDaysUrl();
      urlDia.searchParams.set("select", "*");
      urlDia.searchParams.set("user_id", `eq.${usuarioId}`);
      urlDia.searchParams.set("fecha", `eq.${fechaConsulta}`);
      urlDia.searchParams.set("limit", "1");

      const resDia = await this.requestSupabaseTable(
        urlDia,
        { method: "GET" },
        "daily mission day summary"
      );
      const rowsDia = (await resDia.json()) as unknown;
      if (Array.isArray(rowsDia) && rowsDia.length > 0) {
        resumen = mapDailyMissionDay(rowsDia[0] as SupabaseDailyMissionDayRow);
      }
    } catch (err) {
      this.logger.warn("Could not fetch the daily missions summary", err);
    }

    // 2. Consultar misiones completadas del día
    try {
      const urlMisiones = this.getDailyMissionCompletionsUrl();
      urlMisiones.searchParams.set("select", "*");
      urlMisiones.searchParams.set("user_id", `eq.${usuarioId}`);
      urlMisiones.searchParams.set("fecha", `eq.${fechaConsulta}`);

      const resMisiones = await this.requestSupabaseTable(
        urlMisiones,
        { method: "GET" },
        "daily mission completions"
      );
      const rowsMisiones = (await resMisiones.json()) as unknown;
      if (Array.isArray(rowsMisiones)) {
        for (const row of rowsMisiones) {
          misiones.push(
            mapDailyMissionCompletion(row as SupabaseDailyMissionCompletionRow)
          );
        }
      }
    } catch (err) {
      this.logger.warn("No se pudieron obtener las misiones completadas", err);
    }

    return { resumen, misiones, racha };
  }

  async sincronizarProgresoMisionesDiarias(
    usuarioId: string,
    dto: SincronizarProgresoMisionesDto
  ): Promise<RespuestaProgresoMisiones> {
    const ahoraIso = new Date().toISOString();
    const fecha = dto.fecha ?? ahoraIso.slice(0, 10);
    const misionesInput = dto.misiones ?? [];

    const totalMisiones = misionesInput.length;
    const misionesCompletadas = misionesInput.filter((m) => m.completada ?? m.completed).length;
    const todasCompletadas =
      totalMisiones > 0 && misionesCompletadas >= totalMisiones;

    // 1. Guardar o actualizar misiones individuales en daily_mission_completions
    for (const item of misionesInput) {
      const misionId = item.misionId ?? item.missionId ?? "";
      const completada = Boolean(item.completada ?? item.completed);
      const valorActual = item.valorActual ?? item.currentValue ?? (completada ? 1 : 0);
      const valorObjetivo = item.valorObjetivo ?? item.targetValue ?? 1;

      const payloadMision = {
        user_id: usuarioId,
        fecha,
        mision_id: misionId,
        completada,
        valor_actual: valorActual,
        valor_objetivo: valorObjetivo,
        actualizado_en: ahoraIso
      };

      try {
        const urlItem = this.getDailyMissionCompletionsUrl();
        urlItem.searchParams.set("on_conflict", "user_id,fecha,mision_id");
        await this.requestSupabaseTable(
          urlItem,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify(payloadMision)
          },
          "upsert daily mission completion"
        );
      } catch (err) {
        this.logger.warn(
          `Could not save mission ${misionId} in Supabase`,
          err
        );
      }
    }

    // 2. Obtener estado previo del día para ver si ya se había otorgado el punto de racha
    let puntoRachaOtorgadoPreviamente = false;
    try {
      const urlDiaCheck = this.getDailyMissionDaysUrl();
      urlDiaCheck.searchParams.set("select", "punto_racha_otorgado");
      urlDiaCheck.searchParams.set("user_id", `eq.${usuarioId}`);
      urlDiaCheck.searchParams.set("fecha", `eq.${fecha}`);
      urlDiaCheck.searchParams.set("limit", "1");

      const resCheck = await this.requestSupabaseTable(
        urlDiaCheck,
        { method: "GET" },
        "check daily mission day streak point"
      );
      const rows = (await resCheck.json()) as unknown;
      if (Array.isArray(rows) && rows.length > 0) {
        puntoRachaOtorgadoPreviamente = Boolean(
          (rows[0] as { punto_racha_otorgado?: boolean }).punto_racha_otorgado
        );
      }
    } catch {
      // Ignorar fallo de lectura previa
    }

    // 3. Evaluar y actualizar racha si todas las tareas del día están completadas
    let rachaActualizada = await this.obtenerRachaAstronauta(usuarioId);
    let nuevoPuntoOtorgado = false;

    if (todasCompletadas && !puntoRachaOtorgadoPreviamente) {
      nuevoPuntoOtorgado = true;
      const ultimaFecha = rachaActualizada.ultimaFechaCompletada;

      let nuevaRacha = 1;
      if (ultimaFecha) {
        const diffDias = calcularDiferenciaDias(fecha, ultimaFecha);
        if (diffDias === 0) {
          nuevaRacha = rachaActualizada.rachaActual;
        } else if (diffDias === 1) {
          nuevaRacha = rachaActualizada.rachaActual + 1;
        } else {
          nuevaRacha = 1;
        }
      }

      const nuevaRachaMaxima = Math.max(
        rachaActualizada.rachaMaxima,
        nuevaRacha
      );
      const nuevoTotalDias = rachaActualizada.totalDiasCompletados + 1;

      const payloadRacha = {
        user_id: usuarioId,
        racha_actual: nuevaRacha,
        racha_maxima: nuevaRachaMaxima,
        total_dias_completados: nuevoTotalDias,
        ultima_fecha_completada: fecha,
        actualizado_en: ahoraIso
      };

      try {
        const urlRacha = this.getAstronautStreaksUrl();
        urlRacha.searchParams.set("on_conflict", "user_id");
        await this.requestSupabaseTable(
          urlRacha,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal"
            },
            body: JSON.stringify(payloadRacha)
          },
          "upsert astronaut streak"
        );
      } catch (err) {
        this.logger.warn("No se pudo guardar la racha en Supabase", err);
      }

      rachaActualizada = {
        usuarioId,
        rachaActual: nuevaRacha,
        rachaMaxima: nuevaRachaMaxima,
        totalDiasCompletados: nuevoTotalDias,
        ultimaFechaCompletada: fecha,
        todasCompletadasHoy: true,
        actualizadoEn: ahoraIso,
        userId: usuarioId,
        currentStreak: nuevaRacha,
        maxStreak: nuevaRachaMaxima,
        totalCompletedDays: nuevoTotalDias,
        lastCompletedDate: fecha,
        allCompletedToday: true,
        updatedAt: ahoraIso
      };
    }

    const puntoRachaFinal = puntoRachaOtorgadoPreviamente || nuevoPuntoOtorgado;

    // 4. Guardar o actualizar daily_mission_days
    const payloadDia = {
      user_id: usuarioId,
      fecha,
      total_misiones: totalMisiones,
      misiones_completadas: misionesCompletadas,
      todas_completadas: todasCompletadas,
      punto_racha_otorgado: puntoRachaFinal,
      actualizado_en: ahoraIso
    };

    try {
      const urlDia = this.getDailyMissionDaysUrl();
      urlDia.searchParams.set("on_conflict", "user_id,fecha");
      await this.requestSupabaseTable(
        urlDia,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(payloadDia)
        },
        "upsert daily mission days summary"
      );
    } catch (err) {
      this.logger.warn("Could not save the day in Supabase", err);
    }

    const misionesMapeadas: MisionDiariaProgreso[] = misionesInput.map((m) => {
      const mid = m.misionId ?? m.missionId ?? "";
      const done = Boolean(m.completada ?? m.completed);
      const cur = m.valorActual ?? m.currentValue ?? (done ? 1 : 0);
      const tgt = m.valorObjetivo ?? m.targetValue ?? 1;
      return {
        misionId: mid,
        completada: done,
        valorActual: cur,
        valorObjetivo: tgt,
        actualizadoEn: ahoraIso,
        missionId: mid,
        completed: done,
        currentValue: cur,
        targetValue: tgt
      };
    });

    return {
      fecha,
      totalMisiones,
      misionesCompletadas,
      todasCompletadas,
      puntoRachaOtorgado: puntoRachaFinal,
      racha: rachaActualizada,
      misiones: misionesMapeadas
    };
  }

  async actualizarItemMisionDiaria(
    usuarioId: string,
    misionId: string,
    dto: ActualizarItemMisionDto
  ): Promise<RespuestaProgresoMisiones> {
    const fecha = dto.fecha ?? new Date().toISOString().slice(0, 10);
    const estadoPrevio = await this.obtenerProgresoMisionesDelDia(
      usuarioId,
      fecha
    );

    const misionesMap = new Map<
      string,
      { completada: boolean; valorActual: number; valorObjetivo: number }
    >();
    for (const m of estadoPrevio.misiones) {
      misionesMap.set(m.misionId, {
        completada: m.completada,
        valorActual: m.valorActual,
        valorObjetivo: m.valorObjetivo
      });
    }

    misionesMap.set(misionId, {
      completada: dto.completada,
      valorActual: dto.valorActual ?? (dto.completada ? 1 : 0),
      valorObjetivo: dto.valorObjetivo ?? 1
    });

    const listaMisiones: ItemProgresoMisionDto[] = [];
    for (const [id, vals] of misionesMap.entries()) {
      listaMisiones.push({
        misionId: id,
        completada: vals.completada,
        valorActual: vals.valorActual,
        valorObjetivo: vals.valorObjetivo
      });
    }

    return this.sincronizarProgresoMisionesDiarias(usuarioId, {
      fecha,
      misiones: listaMisiones
    });
  }
}
