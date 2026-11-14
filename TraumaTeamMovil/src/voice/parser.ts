/**
 * Intérprete de comandos de voz (lenguaje natural → intención).
 * Módulo puro, sin dependencias de React ni de Expo: funciona offline,
 * en español e inglés, y es testeable con `node --test`.
 */

export type Route = '/' | '/explore' | '/missions';
export type BodyTab = 'body' | 'health' | 'records';

export type VoiceIntent =
  | { type: 'navigate'; route: Route; label: string }
  | { type: 'open-menu' }
  | { type: 'close-menu' }
  | { type: 'open-alerts' }
  | { type: 'ack-alerts' }
  | { type: 'start-checkin' }
  | { type: 'body-tab'; tab: BodyTab; label: string }
  | { type: 'body-zone'; muscleId: string; muscleName: string }
  | { type: 'toggle-treadmill' }
  | { type: 'read-vitals' }
  | { type: 'help' }
  | { type: 'stop' };

export type ParseResult =
  | { ok: true; intent: VoiceIntent; confidence: number }
  | { ok: false; reason: 'empty' | 'unknown' | 'ambiguous'; hint: string };

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
    return { ok: false, reason: 'ambiguous', hint: `¿${z.name} derecho o izquierdo?` };
  }
  const side = right ? 'der' : 'izq';
  const sideName = right ? 'derecho' : 'izquierdo';
  return {
    ok: true,
    intent: { type: 'body-zone', muscleId: `${z.base}_${side}`, muscleName: `${z.name} ${sideName}` },
    confidence: 0.9,
  };
}

// ---------------------------------------------------------------- comandos
const GO = ['ir', 've', 'vamos', 'llevame', 'abre', 'abrir', 'muestrame', 'mostrar', 'muestra', 'quiero ver', 'go', 'open', 'show', 'take me', 'ver'];

export function parseCommand(raw: string): ParseResult {
  const text = normalize(raw);
  if (!text) return { ok: false, reason: 'empty', hint: 'No te escuché. Intenta de nuevo.' };
  const ok = (intent: VoiceIntent, confidence = 0.85): ParseResult => ({ ok: true, intent, confidence });

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

  return {
    ok: false,
    reason: 'unknown',
    hint: 'No entendí. Prueba: "abre signos vitales", "iniciar chequeo diario" o "ve al bíceps derecho".',
  };
}

export const VOICE_EXAMPLES: string[] = [
  'Abre signos vitales',
  'Iniciar chequeo diario',
  'Ve al bíceps derecho',
  'Me duele la espalda izquierda',
  'Ir a misiones',
  'Ver mis alertas',
  'Marcar alertas como leídas',
  'Abrir menú',
];
