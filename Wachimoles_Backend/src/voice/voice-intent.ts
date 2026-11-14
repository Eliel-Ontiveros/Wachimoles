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
  | { type: "stop" };

export const ROUTES: Record<string, string> = {
  "/": "Monitoreo Vital",
  "/explore": "Vista Corporal",
  "/missions": "Misiones y Viaje"
};

export const TABS: Record<string, string> = {
  body: "Vista 3D",
  health: "Cuestionario",
  records: "Registros"
};

export const MUSCLES: Record<string, string> = {
  cara: "Cara / Región facial",
  cabeza: "Cabeza / Cráneo",
  cuello: "Cuello",
  trapecio: "Trapecio / Nuca",
  abdomen: "Abdomen",
  lumbar: "Zona lumbar",
  pectoral_der: "Pectoral derecho",
  pectoral_izq: "Pectoral izquierdo",
  oblicuo_der: "Oblicuo derecho",
  oblicuo_izq: "Oblicuo izquierdo",
  dorsal_der: "Dorsal derecho",
  dorsal_izq: "Dorsal izquierdo",
  deltoides_der: "Deltoides derecho",
  deltoides_izq: "Deltoides izquierdo",
  biceps_der: "Bíceps derecho",
  biceps_izq: "Bíceps izquierdo",
  triceps_der: "Tríceps derecho",
  triceps_izq: "Tríceps izquierdo",
  antebrazo_der: "Antebrazo derecho",
  antebrazo_izq: "Antebrazo izquierdo",
  mano_der: "Mano derecha",
  mano_izq: "Mano izquierda",
  gluteo_der: "Glúteo derecho",
  gluteo_izq: "Glúteo izquierdo",
  abductor_der: "Abductor / Cadera derecha",
  abductor_izq: "Abductor / Cadera izquierda",
  muslo_der: "Muslo derecho (Cuádriceps)",
  muslo_izq: "Muslo izquierdo (Cuádriceps)",
  isquio_der: "Isquiotibiales derecho",
  isquio_izq: "Isquiotibiales izquierdo",
  gemelo_der: "Gemelo derecho (Pantorrilla)",
  gemelo_izq: "Gemelo izquierdo (Pantorrilla)",
  espinilla_der: "Espinilla / Tibial derecho",
  espinilla_izq: "Espinilla / Tibial izquierdo",
  pie_der: "Pie derecho",
  pie_izq: "Pie izquierdo"
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
  "stop"
]);

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
  return null;
}
