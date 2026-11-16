import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  bmiGauge,
  bodyFatGauge,
  bodyWaterGauge,
  weightGauge,
} from '../src/utils/body-composition.ts';
import {
  fetchBodyProfileFromBackend,
  fetchLatestWeightFromBackend,
  resetBackendConfig,
  updateBackendConfig,
} from '../src/services/backend-api.ts';
import type { WeightRecord } from '../src/types/dashboard.ts';

afterEach(resetBackendConfig);

const exact = {
  bmi: 27.45,
  bmiCategory: 'overweight' as const,
  healthyWeightMinKg: 57.96,
  healthyWeightMaxKg: 78.01,
  overweightMaxKg: 93.67,
  idealWeightKg: 67.9,
  weightToIdealKg: 18.1,
};

const weighing: WeightRecord = {
  id: 1,
  measurementId: 'm-1',
  weightKg: 86,
  device: 'scale',
  measuredAt: '2026-11-15T05:32:41.731+00:00',
  receivedAt: '2026-11-15T05:32:42.196+00:00',
  metrics: {
    exact,
    estimated: {
      bodyFatPercent: 22,
      fatMassKg: 18.9,
      leanMassKg: 67.1,
      bodyWaterLiters: 48.3,
      bodyWaterPercent: 56.1,
      basalMetabolismKcal: 1856.3,
    },
  },
};

test('classifies BMI with the WHO cut-offs, boundaries included in the upper band', () => {
  const cases: Array<[number, string]> = [
    [15.99, 'low-critical'], [16, 'low-warning'], [18.49, 'low-warning'], [18.5, 'normal'],
    [24.99, 'normal'], [25, 'high-warning'], [29.99, 'high-warning'], [30, 'high-critical'],
  ];
  for (const [bmi, band] of cases) assert.equal(bmiGauge(bmi).band, band, `BMI ${bmi}`);
  assert.deepEqual(bmiGauge(22).legend, {
    lowCritical: '<16', lowWarning: '16–18.4', normal: '18.5–24.9', highWarning: '25–29.9', highCritical: '≥30',
  });
});

test('places the pointer inside its band and in value order', () => {
  const low = bmiGauge(19).pointerPct;
  const high = bmiGauge(24).pointerPct;
  assert.ok(low >= 41 && low <= 59, `normal pointer ${low}`);
  assert.ok(high >= 41 && high <= 59, `normal pointer ${high}`);
  assert.ok(low < high);
  const over = bmiGauge(27.45).pointerPct;
  assert.ok(over >= 65 && over <= 79, `high-warning pointer ${over}`);
});

test('classifies weight against the healthy and overweight limits of the profile', () => {
  assert.equal(weightGauge(86, exact).band, 'high-warning');
  assert.equal(weightGauge(70, exact).band, 'normal');
  assert.equal(weightGauge(57, exact).band, 'low-warning');
  assert.equal(weightGauge(48, exact).band, 'low-critical');
  assert.equal(weightGauge(95, exact).band, 'high-critical');
  assert.equal(weightGauge(70, exact).legend.normal, '58–78');
});

test('classifies body fat by sex and needs the sex to classify', () => {
  assert.equal(bodyFatGauge(22, 'male')?.band, 'high-warning');
  assert.equal(bodyFatGauge(19.9, 'male')?.band, 'normal');
  assert.equal(bodyFatGauge(25, 'male')?.band, 'high-critical');
  assert.equal(bodyFatGauge(22, 'female')?.band, 'normal');
  assert.equal(bodyFatGauge(39, 'female')?.band, 'high-critical');
  assert.equal(bodyFatGauge(22, null), null);
});

test('classifies body water percentage by sex', () => {
  assert.equal(bodyWaterGauge(56.1, 'male')?.band, 'normal');
  assert.equal(bodyWaterGauge(47, 'male')?.band, 'low-warning');
  assert.equal(bodyWaterGauge(44, 'female')?.band, 'low-warning');
  assert.equal(bodyWaterGauge(56.1, null), null);
});

test('loads the latest weighing with Bearer authentication', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'token' });
  context.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    assert.equal(url, 'https://backend.test/dashboard/weights?limit=1');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer token');
    return new Response(JSON.stringify([weighing]), { status: 200 });
  });
  assert.deepEqual(await fetchLatestWeightFromBackend(), weighing);
});

test('returns null when there are no weighings and rejects malformed ones', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'token' });
  const fetchMock = context.mock.method(globalThis, 'fetch', async () =>
    new Response('[]', { status: 200 }));
  assert.equal(await fetchLatestWeightFromBackend(), null);
  fetchMock.mock.mockImplementation(async () =>
    new Response(JSON.stringify([{ ...weighing, weightKg: '86' }]), { status: 200 }));
  await assert.rejects(fetchLatestWeightFromBackend());
});

test('returns null when no body profile has been set', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'token' });
  const profile = { heightCm: 177, ageYears: 23, sex: 'male', updatedAt: '2026-11-15T05:32:33.766+00:00' };
  const fetchMock = context.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, 'https://backend.test/dashboard/body-profile');
    return new Response(JSON.stringify(profile), { status: 200 });
  });
  assert.deepEqual(await fetchBodyProfileFromBackend(), profile);
  fetchMock.mock.mockImplementation(async () =>
    new Response('{"message":"No body profile has been set."}', { status: 404 }));
  assert.equal(await fetchBodyProfileFromBackend(), null);
});
