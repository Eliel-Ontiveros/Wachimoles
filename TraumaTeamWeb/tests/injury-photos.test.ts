import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { fetchInjuryPhotosFromBackend, resetBackendConfig, updateBackendConfig } from '../src/services/backend-api.ts';
import { parseConditionUpdates } from '../src/utils/condition-updates.ts';

const muscle = { id: 'oblicuo_izq', name: 'Left oblique' };
const image = {
  path: 'test-user/oblicuo_izq/image.jpg',
  signedUrl: 'https://example.supabase.co/storage/v1/object/sign/photos/test-user/oblicuo_izq/image.jpg?token=test',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
};
afterEach(() => resetBackendConfig());

test('loads signed images from the real per-muscle contract with Bearer auth and cancellation', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-token' });
  const controller = new AbortController();
  const fetch = context.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://backend.test/dashboard/body-conditions/oblicuo_izq/images');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-token');
    assert.equal(init.method, 'GET');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal);
    controller.abort();
    assert.equal(init.signal.aborted, true);
    return Response.json([image]);
  });
  const photos = await fetchInjuryPhotosFromBackend(muscle, controller.signal);
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(photos, [{
    id: image.path, muscleId: muscle.id, muscleName: muscle.name,
    uri: image.signedUrl, dayNumber: null, capturedAt: null,
  }]);
});

test('keeps a genuinely empty gallery separate from failed requests', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-token' });
  context.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await fetchInjuryPhotosFromBackend(muscle, new AbortController().signal), []);
});

test('does not silently report unavailable or unauthorized galleries as no photos', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-token' });
  for (const status of [401, 404, 503]) {
    const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    await assert.rejects(fetchInjuryPhotosFromBackend(muscle, new AbortController().signal), { status });
    fetch.mock.restore();
  }
});

test('rejects photos for another muscle, unsafe URLs, expired links and malformed responses', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-token' });
  for (const response of [
    {}, [{ ...image, path: 'test-user/oblicuo_der/image.jpg' }],
    [{ ...image, signedUrl: 'javascript:alert(1)' }],
    [{ ...image, expiresAt: '2000-01-01T00:00:00Z' }],
    [{ ...image, signedUrl: null }],
  ]) {
    const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json(response));
    await assert.rejects(fetchInjuryPhotosFromBackend(muscle, new AbortController().signal));
    fetch.mock.restore();
  }
});

test('requires the image endpoint token before attempting a network request', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: '', webPassword: 'basic-only' });
  const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json([]));
  await assert.rejects(fetchInjuryPhotosFromBackend(muscle, new AbortController().signal), { status: 401 });
  assert.equal(fetch.mock.callCount(), 0);
});

test('keeps history notes and their photo association when capture dates are unknown', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-token' });
  context.mock.method(globalThis, 'fetch', async () => Response.json([image]));
  const photos = await fetchInjuryPhotosFromBackend(muscle, new AbortController().signal);
  const updates = parseConditionUpdates({
    description: 'Update 1 [14/11 12:00] (Pain 6/10) - Follow-up [Photo: image.jpg]\n' +
      'Update 2 [14/11 13:00] (Healed · 0/10) - No pain',
    photos,
  });
  assert.equal(updates.length, 2);
  assert.equal(updates[0].text, 'Follow-up');
  assert.equal(updates[0].photoUri, image.signedUrl);
  assert.equal(updates[1].isResolvedEvent, true);
  assert.equal(updates[1].painIntensity, 0);
});
