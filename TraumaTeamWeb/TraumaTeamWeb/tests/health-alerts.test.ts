import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { parseHealthAlerts, pendingHealthAlertIds, type HealthAlert } from '../../../shared/health-alerts.ts';
import { fetchHealthAlerts, acknowledgeHealthAlert, updateBackendConfig, resetBackendConfig } from '../src/services/backend-api.ts';
const alert: HealthAlert = {
  id: 'episode', astronautId: 'subject', rule: 'pain_threshold', severity: 'critical', muscleId: 'cuello', muscleName: 'Neck',
  value: 8, threshold: 8, createdAt: '2026-11-14T12:00:00Z', updatedAt: '2026-11-14T12:00:00Z', resolvedAt: null, acknowledgedAt: null,
};
afterEach(resetBackendConfig);
test('validates the wire contract before displaying alerts', () => {
  assert.deepEqual(parseHealthAlerts([alert]), [alert]);
  for (const invalid of [null, {}, [{...alert, value: '8'}], [{...alert, createdAt: 'bad'}], [{...alert, rule: 'unknown'}]]) {
    assert.throws(() => parseHealthAlerts(invalid));
  }
});
test('queues each eligible popup once, prioritizing pain over problem count', () => {
  const warning = {...alert, id: 'warning', rule: 'active_problems' as const, severity: 'warning' as const};
  const resolved = {...alert, id: 'resolved', resolvedAt: alert.updatedAt};
  const read = {...alert, id: 'read', acknowledgedAt: alert.updatedAt};
  const delivered = {...alert, id: 'delivered'};
  const queued = {...alert, id: 'queued'};
  assert.deepEqual(pendingHealthAlertIds([warning,resolved,read,delivered,queued,alert],new Set(['delivered']),new Set(['queued'])),['episode','warning']);
  assert.deepEqual(pendingHealthAlertIds([alert], new Set(['episode']), new Set()), []);
  assert.deepEqual(pendingHealthAlertIds([{...alert,id:'recurrence'}],new Set(['episode']),new Set()),['recurrence']);
});
test('uses the monitor audience and existing Bearer authentication', async context => {
  updateBackendConfig({ apiBaseUrl:'https://backend.test',apiToken:'token' });
  context.mock.method(globalThis,'fetch',async (url: string, init: RequestInit) => {
    assert.equal(url,'https://backend.test/dashboard/alerts/monitor');
    assert.equal(new Headers(init.headers).get('Authorization'),'Bearer token');
    return new Response(JSON.stringify([alert]));
  });
  assert.deepEqual(await fetchHealthAlerts(),[alert]);
});
test('supports web credentials and persists monitoring acknowledgement', async context => {
  updateBackendConfig({ apiBaseUrl:'https://backend.test',apiToken:'',webPassword:'secret' });
  context.mock.method(globalThis,'fetch',async (url: string, init: RequestInit) => {
    assert.equal(url,'https://backend.test/dashboard/alerts/monitor/episode/acknowledge');
    assert.equal(init.method,'POST');
    assert.ok(new Headers(init.headers).get('Authorization')?.startsWith('Basic '));
    return new Response(JSON.stringify({acknowledged:true}));
  });
  await acknowledgeHealthAlert('episode');
});
test('does not treat a rejected acknowledgement as saved', async context => {
  updateBackendConfig({ apiBaseUrl:'https://backend.test',apiToken:'token' });
  context.mock.method(globalThis,'fetch',async () => new Response('{}',{status:503}));
  await assert.rejects(acknowledgeHealthAlert('episode'),/503/);
});

test('reports missing alert schema without blaming the connection', async context => {
  updateBackendConfig({ apiBaseUrl:'https://backend.test', apiToken:'token' });
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
    code: 'HEALTH_ALERTS_NOT_READY', message: 'Health alerts are not configured on the server.'
  }), { status: 503 }));
  await assert.rejects(fetchHealthAlerts(), /Health alerts are not configured on the server/);
});
