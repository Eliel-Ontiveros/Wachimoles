import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { askAssistant, parseAssistantAnswer } from '../src/services/assistant-api.ts';
import { resetBackendConfig, updateBackendConfig } from '../src/services/backend-api.ts';
import { buildMuscleAssessmentQuestion, toAssistantEnvironment } from '../src/services/muscle-assessment.ts';
import type { MuscleData } from '../src/types/dashboard.ts';

const muscle: MuscleData = {
  id: 'left-calf', name: 'Pantorrilla izquierda', category: 'Extremidad inferior', status: 'warning',
  center: [0, 0, 0], radii: [1, 1, 1], normal: [0, 0, 1], cameraAngles: [0, 0, 0],
  observation: {
    conditionName: 'Dolor muscular', painIntensity: 6, swelling: true, functionalLimitation: false,
    notes: 'Pain after exercise', updatedAt: '14 Nov', recordedAtIso: '2026-11-14T12:00:00Z',
  },
};
const citation = {
  citationId: 1, title: 'Risks of Human Spaceflight', publisher: 'NASA',
  url: 'https://www.nasa.gov/hrp/risks/', retrievedAt: '2026-11-13T12:00:00Z',
  chunkId: 'nasa-risks-1', wordOffset: 0, excerpt: 'A retrieved passage from the indexed document.',
};
const generated = {
  mode: 'generated', answer: 'A supported research finding. [1]', citations: [citation], notice: 'Educational prototype.',
};

afterEach(() => resetBackendConfig());

test('builds a bounded request with all reported symptoms, timestamp and selected context', () => {
  const body = buildMuscleAssessmentQuestion(muscle, toAssistantEnvironment('nave'))!;
  assert.equal(body.environment, 'spacecraft');
  assert.equal(body.bodyZone, muscle.name);
  for (const text of ['Dolor muscular', '6/10', 'Swelling: reported', 'Functional limitation: not reported',
    'Pain after exercise', '2026-11-14T12:00:00Z', 'Do not infer a diagnosis']) {
    assert.ok(body.question.includes(text), text);
  }
  const long = buildMuscleAssessmentQuestion({ ...muscle, observation: {
    ...muscle.observation!, conditionName: 'a'.repeat(1000), notes: 'b'.repeat(5000),
  } }, 'mars')!;
  assert.ok(long.question.length <= 1500);
  assert.equal(toAssistantEnvironment('tierra'), 'earth');
  assert.equal(toAssistantEnvironment('luna'), 'moon');
  assert.equal(toAssistantEnvironment('marte'), 'mars');
});

test('does not request assessments for absent or resolved muscle reports', () => {
  assert.equal(buildMuscleAssessmentQuestion({ ...muscle, observation: undefined }, 'earth'), null);
  assert.equal(buildMuscleAssessmentQuestion({ ...muscle, status: 'normal' }, 'earth'), null);
});

test('accepts each real backend response mode without fabricating a diagnosis', () => {
  assert.deepEqual(parseAssistantAnswer(generated), generated);
  for (const mode of ['evidence_only', 'generation_unavailable', 'insufficient_evidence']) {
    assert.equal(parseAssistantAnswer({ ...generated, mode, citations: [], answer: 'No synthesis available.' }).mode, mode);
  }
});

test('rejects fabricated, missing or duplicate references and untrusted source URLs', () => {
  for (const invalid of [
    { ...generated, citations: [] },
    { ...generated, answer: 'Uncited medical claim.' },
    { ...generated, answer: 'Fabricated source. [99]' },
    { ...generated, answer: 'Supported. [1]\n\nAn unsupported extra paragraph.' },
    { ...generated, citations: [citation, citation] },
    { ...generated, citations: [{ ...citation, url: 'javascript:alert(1)' }] },
    { ...generated, citations: [{ ...citation, url: 'https://www.nasa.gov.evil.test/article' }] },
    { ...generated, citations: [{ ...citation, url: 'https://user:secret@www.nasa.gov/article' }] },
    { ...generated, citations: [{ ...citation, excerpt: '' }] },
    { ...generated, mode: 'diagnosis' },
  ]) assert.throws(() => parseAssistantAnswer(invalid));
});

test('accepts selected scientific source hosts while rejecting lookalike hosts', () => {
  for (const host of ['pmc.ncbi.nlm.nih.gov', 'link.springer.com', 'www.frontiersin.org']) {
    const value = { ...generated, citations: [{ ...citation, url: `https://${host}/article`, contentKind: 'reviewed_summary' }] };
    assert.equal(parseAssistantAnswer(value).citations[0].url, `https://${host}/article`);
    assert.throws(() => parseAssistantAnswer({ ...value, citations: [{ ...citation, url: `https://${host}.evil.test/article` }] }));
  }
});

test('calls the existing authenticated RAG endpoint with cancellation and a longer deadline', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-dashboard-token' });
  const abort = new AbortController();
  const body = buildMuscleAssessmentQuestion(muscle, 'moon')!;
  const fetch = context.mock.method(globalThis, 'fetch', async (url: URL, init: RequestInit) => {
    assert.equal(String(url), 'https://backend.test/dashboard/assistant/ask');
    assert.equal(init.method, 'POST');
    assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer test-dashboard-token');
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(String(init.body)), body);
    assert.ok(init.signal instanceof AbortSignal);
    abort.abort();
    assert.equal(init.signal.aborted, true);
    return Response.json(generated);
  });
  assert.deepEqual(await askAssistant(body, abort.signal), generated);
  assert.equal(fetch.mock.callCount(), 1);
});

test('reports rejected credentials and index failures without automatic paid retries', async (context) => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: 'test-token' });
  for (const [status, message] of [[401, /rejected.*token/], [503, /document index/], [429, /429/]] as const) {
    const fetch = context.mock.method(globalThis, 'fetch', async () => new Response('', { status }));
    await assert.rejects(askAssistant({ question: 'muscle pain', environment: 'earth' }, new AbortController().signal), message);
    assert.equal(fetch.mock.callCount(), 1);
    fetch.mock.restore();
  }
});

test('requires the RAG token even when Basic dashboard credentials are present', async () => {
  updateBackendConfig({ apiBaseUrl: 'https://backend.test', apiToken: '', webPassword: 'dashboard-only' });
  await assert.rejects(askAssistant({ question: 'muscle pain', environment: 'earth' }, new AbortController().signal), /VITE_DASHBOARD_API_TOKEN/);
});
