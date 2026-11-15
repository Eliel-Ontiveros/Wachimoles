const assert = require("node:assert/strict");
const { test } = require("node:test");
const { uploadMeasurement } = require("../src/uploader");
const { buildMeasurement } = require("../src/measurement");

const measurement = buildMeasurement(72.4, 1794190000000);
const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
const base = { url: "https://example.test/api/weights", apiKey: "k".repeat(24), retryDelayMs: 1 };

test("posts JSON with the api key and reports duplicates", async () => {
  let call;
  const result = await uploadMeasurement(measurement, {
    ...base,
    fetchImpl: async (url, options) => {
      call = { url, options };
      return json(200, { ok: true, duplicate: true, receivedAt: 5 });
    }
  });
  assert.deepEqual(result, { duplicate: true, receivedAt: 5 });
  assert.equal(call.options.headers["x-api-key"], base.apiKey);
  assert.equal(JSON.parse(call.options.body).measurementId, measurement.measurementId);
});

test("retries 5xx and then succeeds", async () => {
  let calls = 0;
  const result = await uploadMeasurement(measurement, {
    ...base,
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? json(502, { ok: false, error: "db" }) : json(201, { ok: true, receivedAt: 9 });
    }
  });
  assert.equal(calls, 3);
  assert.equal(result.duplicate, false);
});

test("does not retry 4xx", async () => {
  let calls = 0;
  await assert.rejects(
    uploadMeasurement(measurement, {
      ...base,
      fetchImpl: async () => {
        calls += 1;
        return json(401, { ok: false, error: "Unauthorized." });
      }
    }),
    /Unauthorized/
  );
  assert.equal(calls, 1);
});

test("requires URL and key", async () => {
  await assert.rejects(uploadMeasurement(measurement, { url: "", apiKey: "" }), /SCALE_API_URL/);
});
