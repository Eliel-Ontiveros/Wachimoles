/**
 * Intérprete de comandos de voz (lenguaje natural → intención).
 * Módulo puro, sin dependencias de React ni de Expo: funciona offline,
 * en español e inglés, y es testeable con `node --test`.
 */

export type Route = '/' | '/explore' | '/missions';
export type BodyTab = 'body' | 'health' | 'records';
export type VoiceEnvironment = 'tierra' | 'nave' | 'luna' | 'marte';
export type VitalMetric = 'heart_rate' | 'spo2' | 'stress' | 'sleep';
export const MISSION_IDS = [
  'daily-checkin',
  'treadmill-steps',
  'env-tierra-cardio',
  'env-tierra-core',
  'env-nave-ared',
  'env-nave-stretch',
  'env-luna-eva',
  'env-luna-balance',
  'env-marte-load',
  'env-marte-resp',
] as const;
export type VoiceMissionId = (typeof MISSION_IDS)[number];
export const HEALTH_SYMPTOMS = ['Ninguno', 'Mareo 0g', 'Congestión', 'Fatiga', 'Cefalea'] as const;

/** Campos del cuestionario diario que la voz puede rellenar (nunca se guarda solo). */
export type HealthPrefill = {
  bloodSugarMgDl?: number;
  systolicBp?: number;
  diastolicBp?: number;
  temperatureC?: number;
  sleepHours?: number;
  mood?: 1 | 2 | 3 | 4 | 5;
  symptoms?: string[];
  notes?: string;
};

/** Campos de la observación de zona que la voz puede pre-rellenar. */
export type ObservationPrefill = {
  painIntensity?: number;
  swelling?: boolean;
  functionalLimitation?: boolean;
  notes?: string;
};

export type VoiceIntent =
  | { type: 'navigate'; route: Route; label: string }
  | { type: 'open-menu' }
  | { type: 'close-menu' }
  | { type: 'open-alerts' }
  | { type: 'ack-alerts' }
  | { type: 'start-checkin' }
  | { type: 'body-tab'; tab: BodyTab; label: string }
  | { type: 'body-zone'; muscleId: string; muscleName: string }
  | ({ type: 'register-observation'; muscleId: string; muscleName?: string } & ObservationPrefill)
  | { type: 'zone-detail'; muscleId: string; muscleName?: string }
  | { type: 'zone-photos'; muscleId: string; muscleName?: string }
  | { type: 'set-environment'; environment: VoiceEnvironment }
  | { type: 'open-mission-setup' }
  | { type: 'arrive-early' }
  | { type: 'complete-mission'; missionId: VoiceMissionId }
  | ({ type: 'fill-health-check' } & HealthPrefill)
  | { type: 'vital-history'; metric: VitalMetric }
  | { type: 'dismiss-alert' }
  | { type: 'toggle-treadmill' }
  | { type: 'read-vitals' }
  | { type: 'help' }
  | { type: 'stop' };

export type ParseResult =
  | { ok: true; intent: VoiceIntent; confidence: number }
  | { ok: false; reason: 'empty' | 'unknown' }
  | { ok: false; reason: 'ambiguous'; zone: string };

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distancia de edición, para tolerar errores del reconocedor ("bisep"). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** ¿La frase contiene la palabra/frase (con tolerancia a 1 error en palabras de 5+ letras)? */
function has(text: string, phrase: string): boolean {
  const padded = ` ${text} `;
  if (padded.includes(` ${phrase} `)) return true;
  if (phrase.includes(' ') || phrase.length < 5) return false;
  return text.split(' ').some((w) => w.length >= 5 && (w.startsWith(phrase) || levenshtein(w, phrase) <= 1));
}

const hasAny = (text: string, phrases: string[]) => phrases.some((p) => has(text, p));

// ---------------------------------------------------------------- zonas
type ZoneDef = { base: string; name: string; keys: string[]; sided: boolean; ids?: [string, string] };

const ZONES: ZoneDef[] = [
  { base: 'cara', name: 'Cara / Región facial', keys: ['cara', 'rostro', 'face'], sided: false },
  { base: 'cabeza', name: 'Cabeza / Cráneo', keys: ['cabeza', 'craneo', 'head', 'skull'], sided: false },
  { base: 'cuello', name: 'Cuello', keys: ['cuello', 'neck'], sided: false },
  { base: 'trapecio', name: 'Trapecio / Nuca', keys: ['trapecio', 'nuca', 'trapezius'], sided: false },
  { base: 'pectoral', name: 'Pectoral', keys: ['pectoral', 'pecho', 'chest'], sided: true },
  { base: 'abdomen', name: 'Abdomen', keys: ['abdomen', 'estomago', 'barriga', 'abs', 'stomach'], sided: false },
  { base: 'oblicuo', name: 'Oblicuo', keys: ['oblicuo', 'costado', 'oblique'], sided: true },
  { base: 'dorsal', name: 'Dorsal', keys: ['dorsal', 'espalda', 'back'], sided: true },
  { base: 'lumbar', name: 'Zona lumbar', keys: ['lumbar', 'cintura', 'lumbago', 'lower back'], sided: false },
  { base: 'deltoides', name: 'Deltoides', keys: ['deltoides', 'hombro', 'shoulder'], sided: true },
  { base: 'biceps', name: 'Bíceps', keys: ['biceps', 'bicep'], sided: true },
  { base: 'triceps', name: 'Tríceps', keys: ['triceps', 'tricep'], sided: true },
  { base: 'antebrazo', name: 'Antebrazo', keys: ['antebrazo', 'forearm'], sided: true },
  { base: 'mano', name: 'Mano', keys: ['mano', 'munieca', 'hand', 'wrist'], sided: true },
  { base: 'gluteo', name: 'Glúteo', keys: ['gluteo', 'gluteos', 'nalga', 'glute'], sided: true },
  { base: 'abductor', name: 'Abductor / Cadera', keys: ['abductor', 'cadera', 'hip'], sided: true },
  { base: 'muslo', name: 'Muslo (Cuádriceps)', keys: ['muslo', 'cuadriceps', 'quadriceps', 'quad', 'thigh'], sided: true },
  { base: 'isquio', name: 'Isquiotibiales', keys: ['isquiotibiales', 'isquios', 'hamstring', 'hamstrings'], sided: true },
  { base: 'gemelo', name: 'Gemelo (Pantorrilla)', keys: ['gemelo', 'pantorrilla', 'calf'], sided: true },
  { base: 'espinilla', name: 'Espinilla / Tibial', keys: ['espinilla', 'tibial', 'shin'], sided: true },
  { base: 'pie', name: 'Pie', keys: ['pie', 'pies', 'foot', 'tobillo', 'ankle'], sided: true },
];

const RIGHT = ['derecho', 'derecha', 'der', 'right'];
const LEFT = ['izquierdo', 'izquierda', 'izq', 'left'];

function parseZone(text: string): ParseResult | null {
  // El nombre más largo gana ("lower back" antes que "back").
  const candidates = ZONES.flatMap((z) => z.keys.map((k) => ({ z, k })))
    .filter(({ k }) => has(text, k))
    .sort((a, b) => b.k.length - a.k.length);
  const hit = candidates[0];
  if (!hit) return null;
  const { z } = hit;
  if (!z.sided) {
    return { ok: true, intent: { type: 'body-zone', muscleId: z.base, muscleName: z.name }, confidence: 0.9 };
  }
  const right = hasAny(text, RIGHT);
  const left = hasAny(text, LEFT);
  if (right === left) {
    return { ok: false, reason: 'ambiguous', zone: z.name };
  }
  const side = right ? 'der' : 'izq';
  const sideName = right ? 'derecho' : 'izquierdo';
  return {
    ok: true,
    intent: { type: 'body-zone', muscleId: `${z.base}_${side}`, muscleName: `${z.name} ${sideName}` },
    confidence: 0.9,
  };
}

/** Nombre legible de una zona a partir de su id (`deltoides_izq` → "Deltoides izquierdo"). */
export function zoneNameFor(muscleId: string): string {
  const m = /^(.*?)(?:_(der|izq))?$/.exec(muscleId);
  const def = ZONES.find((z) => z.base === (m?.[1] ?? muscleId));
  if (!def) return muscleId;
  return m?.[2] ? `${def.name} ${m[2] === 'der' ? 'derecho' : 'izquierdo'}` : def.name;
}

// ---------------------------------------------------------------- comandos
const GO = ['ir', 've', 'vamos', 'llevame', 'abre', 'abrir', 'muestrame', 'mostrar', 'muestra', 'quiero ver', 'go', 'open', 'show', 'take me', 'ver'];

export function parseCommand(raw: string): ParseResult {
  const text = normalize(raw);
  if (!text) return { ok: false, reason: 'empty' };
  const ok = (intent: VoiceIntent, confidence = 0.85): ParseResult => ({ ok: true, intent, confidence });

  const lite = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[.,](\d)/g, '$1_$2')
    .replace(/[^a-z0-9_\s]/g, ' ')
    .replace(/_/g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  // ---- Acciones de la app (tienen prioridad sobre navegación y zonas)
  if (hasAny(text, ['cerrar', 'cierra', 'descarta', 'descartar', 'quita', 'quitar', 'dismiss', 'close']) && (has(text, 'alerta') || has(text, 'alert'))) {
    return ok({ type: 'dismiss-alert' });
  }

  const metricWord = (
    [
      ['heart_rate', ['pulso', 'ritmo', 'corazon', 'cardiaco', 'cardiaca', 'latidos', 'heart']],
      ['spo2', ['oxigeno', 'spo2', 'saturacion', 'oxygen']],
      ['stress', ['estres', 'stress']],
      ['sleep', ['sueno', 'dormir', 'sleep']],
    ] as [VitalMetric, string[]][]
  ).find(([, words]) => hasAny(text, words));
  if (metricWord && hasAny(text, ['historial', 'history', 'historico', 'historic'])) {
    return ok({ type: 'vital-history', metric: metricWord[0] });
  }

  if (hasAny(text, ['llegamos antes', 'llegada anticipada', 'llegar antes', 'adelantar llegada', 'arrive early', 'arrived early', 'early arrival'])) {
    return ok({ type: 'arrive-early' });
  }
  if (hasAny(text, ['configurar', 'configura', 'configure', 'setup', 'set up']) && hasAny(text, ['mision', 'viaje', 'mission', 'journey', 'trip'])) {
    return ok({ type: 'open-mission-setup' });
  }

  const envWords: [VoiceEnvironment, string[]][] = [
    ['marte', ['marte', 'mars']],
    ['luna', ['luna', 'moon']],
    ['tierra', ['tierra', 'earth']],
    ['nave', ['nave', 'estacion', 'station', 'spaceship', 'ship']],
  ];
  const env = envWords.find(([, w]) => hasAny(text, w));
  if (env && hasAny(text, ['entorno', 'ambiente', 'environment', 'estoy en', 'i am on', 'i am in'])) {
    return ok({ type: 'set-environment', environment: env[0] });
  }

  if (hasAny(text, ['mision', 'mission']) && hasAny(text, ['completa', 'completar', 'completado', 'termina', 'terminar', 'termine', 'marca', 'marcar', 'hice', 'complete', 'finish', 'mark', 'done'])) {
    const missionWords: [VoiceMissionId, string[]][] = [
      ['env-tierra-cardio', ['cardio']],
      ['env-tierra-core', ['core', 'abdominales']],
      ['env-nave-ared', ['ared']],
      ['env-nave-stretch', ['estiramiento', 'estiramientos', 'stretch', 'stretching']],
      ['env-luna-eva', ['eva']],
      ['env-luna-balance', ['equilibrio', 'balance']],
      ['env-marte-load', ['carga', 'load']],
      ['env-marte-resp', ['respiracion', 'breathing']],
      ['daily-checkin', ['chequeo', 'check in', 'checkin']],
      ['treadmill-steps', ['pasos', 'steps', 'cinta', 'treadmill']],
    ];
    const hit = missionWords.find(([, w]) => hasAny(text, w));
    if (hit) return ok({ type: 'complete-mission', missionId: hit[0] });
  }

  // Cuestionario diario: se rellena, nunca se guarda solo (S2)
  const health: HealthPrefill = {};
  const num = (re: RegExp) => re.exec(lite);
  const gm = num(/(?:glucosa|azucar|glucose|sugar)\D{0,15}?(\d{2,3})\b/);
  if (gm) health.bloodSugarMgDl = Number(gm[1]);
  const bm = num(/(?:presion|tension|blood pressure|pressure|\bbp\b)\D{0,20}?(\d{2,3})\D{1,8}?(\d{2,3})\b/);
  if (bm) {
    health.systolicBp = Number(bm[1]);
    health.diastolicBp = Number(bm[2]);
  }
  const tm = num(/(?:temperatura|temperature|\btemp\b|fiebre)\D{0,15}?(\d{2}(?:\.\d)?)\b/);
  if (tm) health.temperatureC = Number(tm[1]);
  const sm = num(/(?:dormi|duermo|sleep|slept)\D{0,15}?(\d{1,2}(?:\.\d)?)\b/);
  if (sm) health.sleepHours = Number(sm[1]);
  if (hasAny(text, ['me siento', 'me encuentro', 'i feel', 'i am feeling'])) {
    const moods: [1 | 2 | 3 | 4 | 5, string[]][] = [
      [1, ['muy mal', 'terrible', 'fatal', 'horrible', 'awful']],
      [5, ['muy bien', 'excelente', 'genial', 'great', 'fantastic', 'amazing']],
      [2, ['mal', 'triste', 'agotado', 'bad', 'sad', 'exhausted']],
      [3, ['cansado', 'cansada', 'regular', 'mas o menos', 'tired', 'so so', 'meh', 'okay']],
      [4, ['bien', 'good', 'fine', 'well']],
    ];
    const mood = moods.find(([, w]) => hasAny(text, w));
    if (mood) health.mood = mood[0];
  }
  const symptoms: string[] = [];
  const symptomWords: [string, string[]][] = [
    ['Mareo 0g', ['mareo', 'mareado', 'mareada', 'dizzy', 'dizziness']],
    ['Congestión', ['congestion', 'congestionado', 'congestionada', 'congested', 'stuffy']],
    ['Fatiga', ['fatiga', 'fatigue', 'fatigued']],
    ['Cefalea', ['cefalea', 'migrana', 'headache']],
  ];
  for (const [name, w] of symptomWords) if (hasAny(text, w)) symptoms.push(name);
  const hasOtherField = Object.keys(health).length > 0;
  if (!symptoms.length && (hasOtherField || hasAny(text, ['sintoma', 'sintomas', 'symptom', 'symptoms'])) && has(text, 'dolor de cabeza')) {
    symptoms.push('Cefalea');
  }
  const wantsSymptoms = hasAny(text, ['tengo', 'siento', 'sintoma', 'sintomas', 'i have', 'i feel', 'symptom', 'symptoms']) || hasOtherField;
  if (symptoms.length && wantsSymptoms) health.symptoms = symptoms;
  if (Object.keys(health).length > 0) return ok({ type: 'fill-health-check', ...health }, 0.8);

  // Zona del cuerpo + acción (registrar / detalles / fotos)
  const registerVerb = hasAny(text, ['registrar', 'registra', 'anotar', 'anota', 'agregar', 'agrega', 'reportar', 'reporta', 'register', 'report', 'add', 'log']);
  const painWord = hasAny(text, ['molestia', 'molestias', 'dolor', 'lesion', 'lastimadura', 'pain', 'injury', 'discomfort']);
  const detailWord = hasAny(text, ['detalle', 'detalles', 'detail', 'details']);
  const photoWord = hasAny(text, ['foto', 'fotos', 'fotografia', 'fotografias', 'photo', 'photos', 'timelapse']);
  if ((registerVerb && painWord) || detailWord || photoWord) {
    const z = parseZone(text);
    if (z && !z.ok) return z;
    if (z && z.ok && z.intent.type === 'body-zone') {
      const { muscleId, muscleName } = z.intent;
      if (registerVerb && painWord) {
        const reg: Extract<VoiceIntent, { type: 'register-observation' }> = { type: 'register-observation', muscleId, muscleName };
        const pm = /(?:dolor|pain|intensidad|intensity|nivel|level)\s*(?:de|of)?\s*(\d{1,2})\b/.exec(lite) ?? /\b(\d{1,2})\s*(?:de|\/|out of)\s*10\b/.exec(lite);
        if (pm) reg.painIntensity = Math.min(10, Math.max(1, Number(pm[1])));
        else if (hasAny(text, ['leve', 'suave', 'mild', 'slight'])) reg.painIntensity = 3;
        else if (hasAny(text, ['moderado', 'moderada', 'moderate'])) reg.painIntensity = 5;
        else if (hasAny(text, ['fuerte', 'intenso', 'intensa', 'severo', 'severa', 'strong', 'severe', 'intense'])) reg.painIntensity = 8;
        if (hasAny(text, ['hinchado', 'hinchada', 'hinchazon', 'inflamado', 'inflamada', 'swollen', 'swelling'])) reg.swelling = true;
        if (hasAny(text, ['limitacion', 'limitado', 'limitada', 'no puedo mover', 'cannot move', 'limited'])) reg.functionalLimitation = true;
        return ok(reg, 0.85);
      }
      if (detailWord) return ok({ type: 'zone-detail', muscleId, muscleName }, 0.85);
      return ok({ type: 'zone-photos', muscleId, muscleName }, 0.85);
    }
  }

  if (hasAny(text, ['ayuda', 'que puedo decir', 'comandos', 'help', 'what can i say'])) return ok({ type: 'help' }, 1);
  if (hasAny(text, ['cancela', 'cancelar', 'detente', 'para', 'basta', 'stop', 'cancel'])) return ok({ type: 'stop' }, 1);

  if (hasAny(text, ['cierra el menu', 'cerrar menu', 'cierra menu', 'close menu', 'close the menu'])) return ok({ type: 'close-menu' });
  if (hasAny(text, ['abre el menu', 'abrir menu', 'abre menu', 'menu', 'open menu', 'open the menu'])) return ok({ type: 'open-menu' });

  if (hasAny(text, ['marcar', 'marca', 'lee', 'leer', 'mark', 'clear', 'limpia']) && hasAny(text, ['alertas', 'notificaciones', 'alerts', 'notifications'])) {
    return ok({ type: 'ack-alerts' });
  }
  if (hasAny(text, ['alertas', 'notificaciones', 'campana', 'alerts', 'notifications'])) return ok({ type: 'open-alerts' });

  if (hasAny(text, ['cuanto tengo', 'como estan mis signos', 'lee mis signos', 'dime mis signos', 'read my vitals', 'how are my vitals'])) {
    return ok({ type: 'read-vitals' });
  }

  if (has(text, 'cinta') || has(text, 'treadmill')) return ok({ type: 'toggle-treadmill' });

  // Chequeo diario / cuestionario de salud
  if (hasAny(text, ['chequeo', 'check in', 'checkin', 'cuestionario', 'questionnaire', 'como me siento', 'registrar mi dia', 'daily check'])) {
    return ok({ type: 'start-checkin' });
  }

  // Zona del cuerpo (tiene prioridad sobre "vista corporal" genérica)
  const zone = parseZone(text);
  if (zone && (zone.ok === false || hasAny(text, [...GO, 'zona', 'selecciona', 'seleccionar', 'select', 'zone', 'me duele', 'dolor', 'pain', 'hurts']))) {
    return zone;
  }

  if (hasAny(text, ['registros', 'historial', 'records', 'history'])) return ok({ type: 'body-tab', tab: 'records', label: 'Registros' });
  if (hasAny(text, ['vista 3d', 'modelo 3d', '3d model', 'cuerpo en 3d'])) return ok({ type: 'body-tab', tab: 'body', label: 'Vista 3D' });

  if (hasAny(text, ['signos vitales', 'monitoreo', 'monitor', 'vitales', 'vital signs', 'vitals', 'pulso', 'inicio', 'home', 'dashboard', 'ecg', 'ritmo cardiaco', 'frecuencia cardiaca', 'corazon', 'latidos', 'pulsaciones', 'oxigeno', 'saturacion', 'spo2', 'estres', 'heart rate', 'heart', 'oxygen', 'stress'])) {
    return ok({ type: 'navigate', route: '/', label: 'Monitoreo Vital' });
  }
  if (hasAny(text, ['vista corporal', 'cuerpo', 'body', 'explorar', 'explore', 'lesion', 'lesiones'])) {
    return ok({ type: 'navigate', route: '/explore', label: 'Vista Corporal' });
  }
  if (hasAny(text, ['misiones', 'mision', 'viaje', 'nave', 'racha', 'missions', 'journey', 'streak'])) {
    return ok({ type: 'navigate', route: '/missions', label: 'Misiones y Viaje' });
  }

  return { ok: false, reason: 'unknown' };
}
