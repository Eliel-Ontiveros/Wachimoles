/** Intenciones que el LLM puede devolver. Todo lo demás se descarta. */
export type VoiceIntent =
  | { type: "navigate"; route: "/" | "/explore" | "/missions"; label: string }
  | { type: "open-menu" }
  | { type: "close-menu" }
  | { type: "open-alerts" }
  | { type: "ack-alerts" }
  | { type: "start-checkin" }
  | { type: "body-tab"; tab: "body" | "health" | "records"; label: string }
  | { type: "body-zone"; muscleId: string; muscleName: string }
  | { type: "toggle-treadmill" }
  | { type: "read-vitals" }
  | { type: "help" }
  | { type: "stop" }
  | {
      type: "register-observation";
      muscleId: string;
      painIntensity?: number;
      swelling?: boolean;
      functionalLimitation?: boolean;
      notes?: string;
    }
  | { type: "zone-detail"; muscleId: string }
  | { type: "zone-photos"; muscleId: string }
  | { type: "set-environment"; environment: Environment }
  | { type: "open-mission-setup" }
  | { type: "arrive-early" }
  | { type: "complete-mission"; missionId: MissionId }
  | {
      type: "fill-health-check";
      bloodSugarMgDl?: number;
      systolicBp?: number;
      diastolicBp?: number;
      temperatureC?: number;
      sleepHours?: number;
      mood?: number;
      symptoms?: string[];
      notes?: string;
    }
  | { type: "vital-history"; metric: VitalMetric }
  | { type: "dismiss-alert" }
  | { type: "set-theme"; theme: ThemePreference }
  | { type: "set-locale"; locale: AppLocale }
  | { type: "describe-screen"; screen?: "/" | "/explore" | "/missions" };

export type VoiceScreen = "/" | "/explore" | "/missions";
export type VoiceTab = "body" | "health" | "records";
/** Dónde está el usuario cuando habla (S5). */
export interface VoiceContext {
  screen: VoiceScreen;
  tab?: VoiceTab;
}

/** Todos los tipos de intención que sanitizeIntent acepta. */
export const INTENT_TYPES = [
  "navigate",
  "open-menu",
  "close-menu",
  "open-alerts",
  "ack-alerts",
  "start-checkin",
  "body-tab",
  "body-zone",
  "toggle-treadmill",
  "read-vitals",
  "help",
  "stop",
  "register-observation",
  "zone-detail",
  "zone-photos",
  "set-environment",
  "open-mission-setup",
  "arrive-early",
  "complete-mission",
  "fill-health-check",
  "vital-history",
  "dismiss-alert",
  "set-theme",
  "set-locale",
  "describe-screen"
] as const satisfies readonly VoiceIntent["type"][];
export type IntentType = (typeof INTENT_TYPES)[number];

export type Environment = "tierra" | "nave" | "luna" | "marte";
export type VitalMetric = "heart_rate" | "spo2" | "stress" | "sleep";
export type MissionId =
  | "daily-checkin"
  | "treadmill-steps"
  | "env-tierra-cardio"
  | "env-tierra-core"
  | "env-nave-ared"
  | "env-nave-stretch"
  | "env-luna-eva"
  | "env-luna-balance"
  | "env-marte-load"
  | "env-marte-resp";

export type ThemePreference = "system" | "light" | "dark";
export type AppLocale = "es" | "en";
export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export const APP_LOCALES = ["es", "en"] as const;
export const ENVIRONMENTS = ["tierra", "nave", "luna", "marte"] as const;
export const VITAL_METRICS = ["heart_rate", "spo2", "stress", "sleep"] as const;
export const MISSION_IDS = [
  "daily-checkin",
  "treadmill-steps",
  "env-tierra-cardio",
  "env-tierra-core",
  "env-nave-ared",
  "env-nave-stretch",
  "env-luna-eva",
  "env-luna-balance",
  "env-marte-load",
  "env-marte-resp"
] as const;
export const SYMPTOMS = ["None", "Zero-G dizziness", "Congestion", "Fatigue", "Headache"] as const;
/** Legacy Spanish symptom values (already stored by older clients) → English. */
export const LEGACY_SYMPTOMS: Record<string, (typeof SYMPTOMS)[number]> = {
  Ninguno: "None",
  "Mareo 0g": "Zero-G dizziness",
  Congestión: "Congestion",
  Fatiga: "Fatigue",
  Cefalea: "Headache"
};

export const ROUTES: Record<string, string> = {
  "/": "Vital Monitoring",
  "/explore": "Body View",
  "/missions": "Missions & Journey"
};

export const TABS: Record<string, string> = {
  body: "3D View",
  health: "Questionnaire",
  records: "Records"
};

export const MUSCLES: Record<string, string> = {
  cara: "Face / Facial Region",
  cabeza: "Head / Skull",
  cuello: "Neck",
  trapecio: "Trapezius / Nape",
  abdomen: "Abdomen",
  lumbar: "Lower Back",
  pectoral_der: "Right Pectoral",
  pectoral_izq: "Left Pectoral",
  oblicuo_der: "Right Oblique",
  oblicuo_izq: "Left Oblique",
  dorsal_der: "Right Lat",
  dorsal_izq: "Left Lat",
  deltoides_der: "Right Deltoid",
  deltoides_izq: "Left Deltoid",
  biceps_der: "Right Biceps",
  biceps_izq: "Left Biceps",
  triceps_der: "Right Triceps",
  triceps_izq: "Left Triceps",
  antebrazo_der: "Right Forearm",
  antebrazo_izq: "Left Forearm",
  mano_der: "Right Hand",
  mano_izq: "Left Hand",
  gluteo_der: "Right Glute",
  gluteo_izq: "Left Glute",
  abductor_der: "Right Abductor / Hip",
  abductor_izq: "Left Abductor / Hip",
  muslo_der: "Right Thigh (Quadriceps)",
  muslo_izq: "Left Thigh (Quadriceps)",
  isquio_der: "Right Hamstring",
  isquio_izq: "Left Hamstring",
  gemelo_der: "Right Calf",
  gemelo_izq: "Left Calf",
  espinilla_der: "Right Shin / Tibialis",
  espinilla_izq: "Left Shin / Tibialis",
  pie_der: "Right Foot",
  pie_izq: "Left Foot"
};

const SIMPLE = new Set([
  "open-menu",
  "close-menu",
  "open-alerts",
  "ack-alerts",
  "start-checkin",
  "toggle-treadmill",
  "read-vitals",
  "help",
  "stop",
  "open-mission-setup",
  "arrive-early",
  "dismiss-alert"
]);

function num(v: unknown, min: number, max: number, int = false): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  if (v < min || v > max) return undefined;
  if (int && !Number.isInteger(v)) return undefined;
  return v;
}

function notesOf(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, 300);
  return t ? t : undefined;
}

function oneOf<T extends string>(list: readonly T[], v: unknown): T | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * Valida y reconstruye la intención del LLM contra una lista blanca.
 * Nunca se reenvía JSON del modelo tal cual: solo campos conocidos.
 */
export function sanitizeIntent(raw: unknown): VoiceIntent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const type = r.type;
  if (typeof type !== "string") return null;

  if (SIMPLE.has(type)) return { type } as VoiceIntent;

  if (type === "describe-screen") {
    return typeof r.screen === "string" && Object.hasOwn(ROUTES, r.screen)
      ? { type, screen: r.screen as VoiceScreen }
      : { type };
  }
  if (type === "navigate" && typeof r.route === "string" && r.route in ROUTES) {
    return {
      type,
      route: r.route as "/" | "/explore" | "/missions",
      label: ROUTES[r.route]
    };
  }
  if (type === "body-tab" && typeof r.tab === "string" && r.tab in TABS) {
    return {
      type,
      tab: r.tab as "body" | "health" | "records",
      label: TABS[r.tab]
    };
  }
  if (
    type === "body-zone" &&
    typeof r.muscleId === "string" &&
    Object.hasOwn(MUSCLES, r.muscleId)
  ) {
    return { type, muscleId: r.muscleId, muscleName: MUSCLES[r.muscleId] };
  }
  if (
    (type === "zone-detail" || type === "zone-photos") &&
    typeof r.muscleId === "string" &&
    Object.hasOwn(MUSCLES, r.muscleId)
  ) {
    return { type, muscleId: r.muscleId };
  }
  if (type === "register-observation") {
    if (typeof r.muscleId !== "string" || !Object.hasOwn(MUSCLES, r.muscleId)) return null;
    const out: Extract<VoiceIntent, { type: "register-observation" }> = {
      type,
      muscleId: r.muscleId
    };
    const pain = num(r.painIntensity, 1, 10, true);
    if (pain !== undefined) out.painIntensity = pain;
    if (typeof r.swelling === "boolean") out.swelling = r.swelling;
    if (typeof r.functionalLimitation === "boolean") out.functionalLimitation = r.functionalLimitation;
    const notes = notesOf(r.notes);
    if (notes !== undefined) out.notes = notes;
    return out;
  }
  if (type === "set-environment") {
    const environment = oneOf(ENVIRONMENTS, r.environment);
    return environment ? { type, environment } : null;
  }
  if (type === "set-theme") {
    const theme = oneOf(THEME_PREFERENCES, r.theme);
    return theme ? { type, theme } : null;
  }
  if (type === "set-locale") {
    const locale = oneOf(APP_LOCALES, r.locale);
    return locale ? { type, locale } : null;
  }
  if (type === "complete-mission") {
    const missionId = oneOf(MISSION_IDS, r.missionId);
    return missionId ? { type, missionId } : null;
  }
  if (type === "vital-history") {
    const metric = oneOf(VITAL_METRICS, r.metric);
    return metric ? { type, metric } : null;
  }
  if (type === "fill-health-check") {
    const out: Extract<VoiceIntent, { type: "fill-health-check" }> = { type };
    const bs = num(r.bloodSugarMgDl, 20, 600);
    if (bs !== undefined) out.bloodSugarMgDl = bs;
    const sys = num(r.systolicBp, 50, 260);
    if (sys !== undefined) out.systolicBp = sys;
    const dia = num(r.diastolicBp, 30, 160);
    if (dia !== undefined) out.diastolicBp = dia;
    const temp = num(r.temperatureC, 30, 45);
    if (temp !== undefined) out.temperatureC = temp;
    const sleep = num(r.sleepHours, 0, 24);
    if (sleep !== undefined) out.sleepHours = sleep;
    const mood = num(r.mood, 1, 5, true);
    if (mood !== undefined) out.mood = mood;
    if (Array.isArray(r.symptoms)) {
      const symptoms = [
        ...new Set(
          r.symptoms.flatMap((x): string[] => {
            if (typeof x !== "string") return [];
            if ((SYMPTOMS as readonly string[]).includes(x)) return [x];
            return Object.prototype.hasOwnProperty.call(LEGACY_SYMPTOMS, x) ? [LEGACY_SYMPTOMS[x]] : [];
          })
        )
      ];
      if (symptoms.length) out.symptoms = symptoms;
    }
    const notes = notesOf(r.notes);
    if (notes !== undefined) out.notes = notes;
    return Object.keys(out).length > 1 ? out : null;
  }
  return null;
}
