/**
 * Motor de diálogo por voz (relleno de huecos): dada una intención incompleta
 * decide la siguiente pregunta y procesa cada respuesta hasta tener la
 * intención completa. Módulo puro (sin React ni Expo), testeable con `node --test`.
 */
import type { MessageKey } from '../i18n/messages';
// @ts-expect-error TS5097: `node --test` necesita la extensión .ts en los imports relativos.
import { zoneNameFor, zoneNeedsSide, type HealthPrefill, type VoiceIntent } from './parser.ts';

export type Question = {
  key: MessageKey;
  params?: Record<string, string | number>;
  /** Pista que se antepone cuando se repite la pregunta tras una respuesta no entendida. */
  hintKey?: MessageKey;
};

type Slot =
  | 'side'
  | 'pain'
  | 'swelling'
  | 'limitation'
  | 'notes'
  | 'glucose'
  | 'bp'
  | 'temp'
  | 'sleep'
  | 'mood'
  | 'symptoms';

export type DialogState = {
  intent: VoiceIntent;
  /** Huecos pendientes; el primero es el que se está preguntando. */
  queue: Slot[];
  /** Respuestas inválidas seguidas en el hueco actual. */
  fails: number;
};

export type DialogResult = {
  state: DialogState;
  question?: Question;
  done?: VoiceIntent;
  cancelled?: true;
  retry?: true;
  failed?: true;
};

const MAX_FAILS = 2;

// ---------------------------------------------------------------- números
const UNITS: Record<string, number> = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, hundred: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600,
};
const DECIMAL_MARKERS = new Set(['punto', 'coma', 'point', 'comma', 'dot']);

/** Minúsculas, sin acentos, conserva decimales (`36,5` → `36.5`) y quita el resto de puntuación. */
function clean(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(\d)[.,](\d)/g, '$1_$2')
    .replace(/[^a-z0-9_\s]/g, ' ')
    .replace(/_/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

type Num = { v: number; raw: string };

/** Números de un tramo de tokens (sin marcador decimal). */
function numbersFrom(tokens: string[]): Num[] {
  const out: Num[] = [];
  let acc: number | null = null;
  let last: 'unit' | 'tens' | 'hundred' | null = null;
  const flush = () => {
    if (acc !== null) out.push({ v: acc, raw: String(acc) });
    acc = null;
    last = null;
  };
  for (const tok of tokens) {
    if (/^\d+(\.\d+)?$/.test(tok)) {
      flush();
      out.push({ v: Number(tok), raw: tok });
    } else if (tok in HUNDREDS) {
      const v = HUNDREDS[tok];
      if (acc !== null && acc < 10 && v === 100 && tok === 'hundred') acc *= 100;
      else {
        flush();
        acc = v;
      }
      last = 'hundred';
    } else if (tok in TENS) {
      if (acc !== null && last === 'hundred') acc += TENS[tok];
      else {
        flush();
        acc = TENS[tok];
      }
      last = 'tens';
    } else if (tok in UNITS) {
      const v = UNITS[tok];
      if (acc !== null && (last === 'hundred' || (last === 'tens' && v < 10))) {
        acc += v;
        last = 'unit';
      } else {
        flush();
        acc = v;
        last = 'unit';
      }
    } else if ((tok === 'y' || tok === 'and') && acc !== null && last === 'tens') {
      // "treinta y seis": el conector no corta el número
    } else {
      flush();
    }
  }
  flush();
  return out;
}

/** Números dichos en una frase: dígitos, palabras es/en, "36,5", "X punto Y". */
export function extractNumbers(text: string): number[] {
  const tokens = clean(text).split(' ').filter(Boolean);
  const segments: string[][] = [[]];
  for (const tok of tokens) {
    if (DECIMAL_MARKERS.has(tok)) segments.push([]);
    else segments[segments.length - 1].push(tok);
  }
  let result = numbersFrom(segments[0]);
  for (let i = 1; i < segments.length; i++) {
    const right = numbersFrom(segments[i]);
    const left = result[result.length - 1];
    if (left && right[0] && /^\d+$/.test(left.raw)) {
      const merged = Number(`${left.raw}.${right[0].raw}`);
      result = [...result.slice(0, -1), { v: merged, raw: String(merged) }, ...right.slice(1)];
    } else {
      result = [...result, ...right];
    }
  }
  return result.map((n) => n.v);
}

// ---------------------------------------------------------------- vocabulario
const words = (text: string) => clean(text).split(' ').filter(Boolean);
const anyWord = (tokens: string[], list: string[]) => list.some((w) => tokens.includes(w));
const hasPhrase = (text: string, list: string[]) => list.some((p) => ` ${clean(text)} `.includes(` ${p} `));

const CANCEL = ['cancelar', 'cancela', 'cancel', 'olvidalo', 'dejalo', 'stop', 'detente', 'basta', 'forget'];
const SKIP = ['omitir', 'omite', 'omito', 'salta', 'saltar', 'siguiente', 'skip', 'pass', 'next'];
const SKIP_PHRASES = ['no se', 'ni idea', 'dont know', 'do not know', 'no idea', 'paso de esa'];
const FINISH = ['listo', 'terminar', 'termina', 'terminado', 'finalizar', 'done', 'finish', 'finished'];
const FINISH_PHRASES = ['es todo', 'ya esta', 'eso es todo', 'thats all', 'that is all'];
const YES = ['si', 'claro', 'afirmativo', 'correcto', 'yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'dale', 'tengo', 'hay', 'mucho', 'bastante', 'poco', 'bit', 'little'];
const NO = ['no', 'nada', 'nope', 'negativo', 'ninguno', 'ninguna', 'nothing', 'none', 'sin', 'not', 'nel'];

function yesNo(text: string): boolean | null {
  if (hasPhrase(text, SKIP_PHRASES)) return null;
  const t = words(text);
  if (anyWord(t, NO)) return false;
  if (anyWord(t, YES)) return true;
  return null;
}

const wantsCancel = (text: string) => anyWord(words(text), CANCEL);
const wantsSkip = (text: string) => anyWord(words(text), SKIP) || hasPhrase(text, SKIP_PHRASES);
const wantsFinish = (text: string) => anyWord(words(text), FINISH) || hasPhrase(text, FINISH_PHRASES);

function side(text: string): 'der' | 'izq' | null {
  const t = words(text);
  const right = anyWord(t, ['derecho', 'derecha', 'der', 'right']);
  const left = anyWord(t, ['izquierdo', 'izquierda', 'izq', 'left']);
  if (right === left) return null;
  return right ? 'der' : 'izq';
}

function pain(text: string): number | null {
  if (hasPhrase(text, ['muy fuerte', 'insoportable', 'unbearable', 'very strong', 'very severe', 'very intense', 'worst', 'terrible'])) return 10;
  if (hasPhrase(text, ['fuerte', 'intenso', 'intensa', 'severo', 'severa', 'strong', 'severe', 'intense'])) return 8;
  if (hasPhrase(text, ['moderado', 'moderada', 'medio', 'moderate', 'medium'])) return 5;
  if (hasPhrase(text, ['leve', 'suave', 'poco', 'mild', 'slight', 'light'])) return 3;
  const n = extractNumbers(text)[0];
  return n !== undefined && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

const inRange = (n: number | undefined, lo: number, hi: number): n is number => n !== undefined && n >= lo && n <= hi;

const SYMPTOM_WORDS: [string, string[]][] = [
  ['Mareo 0g', ['mareo', 'mareado', 'mareada', 'dizzy', 'dizziness']],
  ['Congestión', ['congestion', 'congestionado', 'congestionada', 'congested', 'stuffy']],
  ['Fatiga', ['fatiga', 'fatigue', 'fatigued']],
  ['Cefalea', ['cefalea', 'migrana', 'headache', 'dolor de cabeza']],
];

function mood(text: string): 1 | 2 | 3 | 4 | 5 | null {
  if (hasPhrase(text, ['muy bien', 'optimo', 'optima', 'excelente', 'genial', 'great', 'optimal', 'excellent'])) return 5;
  if (hasPhrase(text, ['muy mal', 'mal', 'malo', 'critico', 'critica', 'bad', 'critical', 'terrible'])) return 1;
  if (hasPhrase(text, ['tenso', 'tensa', 'estresado', 'estresada', 'tense', 'stressed'])) return 2;
  if (hasPhrase(text, ['cansado', 'cansada', 'tired', 'regular'])) return 3;
  if (hasPhrase(text, ['bien', 'estable', 'good', 'stable', 'fine', 'well'])) return 4;
  const n = extractNumbers(text)[0];
  return n !== undefined && Number.isInteger(n) && n >= 1 && n <= 5 ? (n as 1 | 2 | 3 | 4 | 5) : null;
}

// ---------------------------------------------------------------- huecos
type Applied = { intent: VoiceIntent; skipped?: boolean } | null;

const NOTES_SKIP = ['no', 'nada', 'ninguna', 'ninguno', 'omitir', 'omite', 'skip', 'none', 'nothing', 'nope', 'sin', 'listo', 'done', 'no gracias'];

function apply(slot: Slot, intent: VoiceIntent, text: string): Applied {
  const health = intent.type === 'fill-health-check' ? intent : null;
  const skip = wantsSkip(text);
  // Los huecos del cuestionario se pueden omitir con "omitir"/"no sé"; el resto exige respuesta.
  if (health && skip && slot !== 'side') return { intent, skipped: true };
  switch (slot) {
    case 'side': {
      const s = side(text);
      if (!s || !('muscleId' in intent)) return null;
      const muscleId = `${intent.muscleId}_${s}`;
      return { intent: { ...intent, muscleId, muscleName: zoneNameFor(muscleId) } };
    }
    case 'pain': {
      const v = pain(text);
      return v === null || intent.type !== 'register-observation' ? null : { intent: { ...intent, painIntensity: v } };
    }
    case 'swelling': {
      const v = yesNo(text);
      return v === null || intent.type !== 'register-observation' ? null : { intent: { ...intent, swelling: v } };
    }
    case 'limitation': {
      const v = yesNo(text);
      return v === null || intent.type !== 'register-observation' ? null : { intent: { ...intent, functionalLimitation: v } };
    }
    case 'notes': {
      if (intent.type !== 'register-observation') return null;
      const t = words(text);
      if (!t.length) return null;
      if (wantsSkip(text) || wantsFinish(text) || (t.length <= 3 && NOTES_SKIP.includes(t[0]))) return { intent, skipped: true };
      return { intent: { ...intent, notes: text.trim().slice(0, 300) } };
    }
    case 'glucose': {
      const n = extractNumbers(text)[0];
      return health && inRange(n, 20, 600) ? { intent: { ...health, bloodSugarMgDl: Math.round(n) } } : null;
    }
    case 'bp': {
      const [sys, dia] = extractNumbers(text);
      return health && inRange(sys, 50, 260) && inRange(dia, 30, 160)
        ? { intent: { ...health, systolicBp: Math.round(sys), diastolicBp: Math.round(dia) } }
        : null;
    }
    case 'temp': {
      const [a, b] = extractNumbers(text);
      let n = a;
      if (n !== undefined && Number.isInteger(n) && b !== undefined && Number.isInteger(b) && b < 10) n = n + b / 10;
      return health && inRange(n, 30, 45) ? { intent: { ...health, temperatureC: n } } : null;
    }
    case 'sleep': {
      let n = extractNumbers(text)[0];
      if (n !== undefined && hasPhrase(text, ['y media', 'and a half', 'y medio'])) n += 0.5;
      return health && inRange(n, 0, 24) ? { intent: { ...health, sleepHours: n } } : null;
    }
    case 'mood': {
      const m = mood(text);
      return health && m !== null ? { intent: { ...health, mood: m } } : null;
    }
    case 'symptoms': {
      if (!health) return null;
      const found = SYMPTOM_WORDS.filter(([, w]) => hasPhrase(text, w)).map(([name]) => name);
      if (found.length) return { intent: { ...health, symptoms: found } };
      return anyWord(words(text), [...NO, 'ninguno']) ? { intent: { ...health, symptoms: ['Ninguno'] } } : null;
    }
  }
}

const QUESTIONS: Record<Slot, { key: MessageKey; hint: MessageKey }> = {
  side: { key: 'dialog.q.side', hint: 'dialog.hint.side' },
  pain: { key: 'dialog.q.pain', hint: 'dialog.hint.pain' },
  swelling: { key: 'dialog.q.swelling', hint: 'dialog.hint.yesno' },
  limitation: { key: 'dialog.q.limitation', hint: 'dialog.hint.yesno' },
  notes: { key: 'dialog.q.notes', hint: 'dialog.hint.notes' },
  glucose: { key: 'dialog.q.glucose', hint: 'dialog.hint.number' },
  bp: { key: 'dialog.q.bp', hint: 'dialog.hint.bp' },
  temp: { key: 'dialog.q.temp', hint: 'dialog.hint.number' },
  sleep: { key: 'dialog.q.sleep', hint: 'dialog.hint.number' },
  mood: { key: 'dialog.q.mood', hint: 'dialog.hint.mood' },
  symptoms: { key: 'dialog.q.symptoms', hint: 'dialog.hint.symptoms' },
};

function missingSlots(intent: VoiceIntent, includeOptional: boolean): Slot[] {
  const slots: Slot[] = [];
  if ('muscleId' in intent && zoneNeedsSide(intent.muscleId)) slots.push('side');
  if (intent.type === 'register-observation') {
    if (intent.painIntensity === undefined) slots.push('pain');
    if (intent.swelling === undefined) slots.push('swelling');
    if (intent.functionalLimitation === undefined) slots.push('limitation');
    if (includeOptional && intent.notes === undefined) slots.push('notes');
  } else if (intent.type === 'fill-health-check') {
    const h: HealthPrefill = intent;
    if (h.bloodSugarMgDl === undefined) slots.push('glucose');
    if (h.systolicBp === undefined || h.diastolicBp === undefined) slots.push('bp');
    if (h.temperatureC === undefined) slots.push('temp');
    if (h.sleepHours === undefined) slots.push('sleep');
    if (h.mood === undefined) slots.push('mood');
    if (h.symptoms === undefined) slots.push('symptoms');
  }
  return slots;
}

/** ¿La intención tiene huecos obligatorios (o el cuestionario está incompleto)? */
export function needsDialog(intent: VoiceIntent): boolean {
  return missingSlots(intent, false).length > 0;
}

function questionFor(state: DialogState): Question {
  const slot = state.queue[0];
  const q = QUESTIONS[slot];
  const params: Record<string, string | number> | undefined =
    slot === 'side' && 'muscleId' in state.intent
      ? { zone: ('muscleName' in state.intent && state.intent.muscleName) || zoneNameFor(state.intent.muscleId) }
      : undefined;
  return { key: q.key, params, hintKey: state.fails > 0 ? q.hint : undefined };
}

/** Empieza un diálogo; si no falta nada devuelve `{ done }` con la intención tal cual. */
export function startDialog(intent: VoiceIntent): { state: DialogState; question: Question } | { done: VoiceIntent; state?: undefined } {
  const queue = missingSlots(intent, true);
  if (!needsDialog(intent)) return { done: intent };
  const state: DialogState = { intent, queue, fails: 0 };
  return { state, question: questionFor(state) };
}

/** Procesa la respuesta del usuario al hueco actual. */
export function answer(state: DialogState, utterance: string): DialogResult {
  if (wantsCancel(utterance)) return { state, cancelled: true };
  const slot = state.queue[0];
  const applied = apply(slot, state.intent, utterance);
  if (!applied) {
    // "listo" en el cuestionario cierra con lo que ya se tiene.
    if (state.intent.type === 'fill-health-check' && wantsFinish(utterance)) return { state, done: state.intent };
    const fails = state.fails + 1;
    const next = { ...state, fails };
    if (fails >= MAX_FAILS) return { state: next, failed: true };
    return { state: next, retry: true, question: questionFor(next) };
  }
  if (state.intent.type === 'fill-health-check' && wantsFinish(utterance) && !applied.skipped) {
    return { state, done: applied.intent };
  }
  const queue = state.queue.slice(1);
  const next: DialogState = { intent: applied.intent, queue, fails: 0 };
  if (!queue.length) return { state: next, done: applied.intent };
  return { state: next, question: questionFor(next) };
}
