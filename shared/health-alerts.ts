/** Wire contract shared by the API and both clients. No clinical advice is inferred. */
export interface HealthAlert {
  id: string;
  astronautId: string;
  rule: 'pain_threshold' | 'active_problems';
  severity: 'critical' | 'warning';
  muscleId: string | null;
  muscleName: string | null;
  value: number;
  threshold: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
}

export function isHealthAlert(value: unknown): value is HealthAlert {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
  return typeof a.id === 'string' && typeof a.astronautId === 'string' &&
    (a.rule === 'pain_threshold' || a.rule === 'active_problems') &&
    (a.severity === 'critical' || a.severity === 'warning') &&
    (a.muscleId === null || typeof a.muscleId === 'string') &&
    (a.muscleName === null || typeof a.muscleName === 'string') &&
    typeof a.value === 'number' && Number.isFinite(a.value) &&
    typeof a.threshold === 'number' && Number.isFinite(a.threshold) &&
    date(a.createdAt) && date(a.updatedAt) &&
    (a.resolvedAt === null || date(a.resolvedAt)) &&
    (a.acknowledgedAt === null || date(a.acknowledgedAt));
}

export function parseHealthAlerts(value: unknown): HealthAlert[] {
  if (!Array.isArray(value) || !value.every(isHealthAlert)) {
    throw new Error('Invalid health alerts response.');
  }
  return value;
}

/** Only open, unread, undelivered episodes may interrupt the astronaut. */
export function pendingHealthAlertIds(alerts: HealthAlert[], delivered: ReadonlySet<string>, queued: ReadonlySet<string>): string[] {
  return alerts.filter(a => !a.resolvedAt && !a.acknowledgedAt && !delivered.has(a.id) && !queued.has(a.id))
    .sort((a, b) => Number(b.severity === 'critical') - Number(a.severity === 'critical') || a.createdAt.localeCompare(b.createdAt))
    .map(a => a.id);
}

export const HEALTH_ALERTS_NOT_READY_MESSAGE = 'Health alerts are not configured on the server. Contact the system administrator.';

/** Safe, actionable message for a missing server-side alert schema. */
export class HealthAlertsNotReadyError extends Error {
  constructor() {
    super(HEALTH_ALERTS_NOT_READY_MESSAGE);
    this.name = 'HealthAlertsNotReadyError';
  }
}

export function isHealthAlertsNotReadyResponse(value: unknown): boolean {
  return typeof value === 'object' && value !== null &&
    'code' in value && value.code === 'HEALTH_ALERTS_NOT_READY';
}
