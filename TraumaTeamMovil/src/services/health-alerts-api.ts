import { parseHealthAlerts, HealthAlertsNotReadyError, isHealthAlertsNotReadyResponse } from '../../../shared/health-alerts';
import { API_CONFIG, fetchBackendWithFallback } from './vital-signs-api';

const listeners = new Set<() => void>();
export function notifyHealthAlertsChanged() { listeners.forEach(listener => listener()); }
export function subscribeHealthAlerts(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

async function request(path: string, method: 'GET' | 'POST') {
  if (!API_CONFIG.dashboardApiToken) throw new Error('Configure the dashboard API token to load alerts.');
  const response = await fetchBackendWithFallback(`/dashboard/alerts/mobile${path}`, {
    method, headers: { Authorization: `Bearer ${API_CONFIG.dashboardApiToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 503 && isHealthAlertsNotReadyResponse(body)) throw new HealthAlertsNotReadyError();
    throw new Error(`Could not sync health alerts (${response.status}).`);
  }
  return response.json();
}
export async function fetchHealthAlerts() { return parseHealthAlerts(await request('', 'GET')); }
export async function acknowledgeHealthAlert(id: string) {
  const result = await request(`/${encodeURIComponent(id)}/acknowledge`, 'POST');
  if (!result || result.acknowledged !== true) throw new Error('Could not confirm that the alert was read.');
}
