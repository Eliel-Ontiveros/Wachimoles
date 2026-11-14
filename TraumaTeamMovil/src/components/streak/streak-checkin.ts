// API imperativa del check-in de racha. `playStreakCheckin()` publica una
// petición; <StreakCheckinHost /> (montado una vez) la renderiza como modal.

export interface StreakCheckinOptions {
  /** Racha YA incrementada (N). El contador anima de N-1 a N. */
  streak: number;
  /** Día de hoy en la fila semanal: 0 = Dom … 6 = Sáb. Por defecto, hoy. */
  todayIndex?: number;
  /** Se llama en el instante en que el fuego se enciende. */
  onIgnite?: () => void;
  /** Se llama cuando termina la secuencia (aparece el botón CONTINUAR). */
  onDone?: () => void;
  /** Se llama cuando el usuario cierra la pantalla. */
  onClose?: () => void;
}

export interface StreakCheckinRequest extends StreakCheckinOptions {
  id: number;
}

let current: StreakCheckinRequest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeStreakCheckin(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStreakCheckinRequest() {
  return current;
}

export function closeStreakCheckin(id?: number) {
  if (current && (id === undefined || current.id === id)) {
    current = null;
    emit();
  }
}

export function playStreakCheckin(opts: StreakCheckinOptions) {
  const req: StreakCheckinRequest = { ...opts, id: nextId++ };
  current = req;
  emit();
  return { destroy: () => closeStreakCheckin(req.id) };
}
