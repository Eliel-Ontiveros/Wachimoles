const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHandler } = require("./samples");

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createSample() {
  return {
    sampleId: "heart_rate-1794190000000",
    metric: "heart_rate",
    value: 72,
    unit: "bpm",
    measuredAt: 1794190000000
  };
}

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key"
};
test("inserts a validated sample into Supabase and confirms persistence", async () => {
  const now = 1794190000000;
  let fetchUrl;
  let fetchOptions;
  const handler = createHandler({
    env,
    now: () => now,
    fetchImpl: async (url, options) => {
      fetchUrl = url;
      fetchOptions = options;
      return {
        ok: true,
        status: 201,
        json: async () => [
          {
            sample_id: "heart_rate-1794190000000",
            received_at: new Date(now).toISOString()
          }
        ]
      };
    }
  });
  const response = createResponse();

  await handler({ method: "POST", body: createSample() }, response);

  assert.equal(fetchUrl, "https://example.supabase.co/rest/v1/samples");
  assert.equal(fetchOptions.method, "POST");
  assert.equal(fetchOptions.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(
    fetchOptions.headers.Authorization,
    `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
  );
  assert.deepEqual(JSON.parse(fetchOptions.body), {
    sample_id: "heart_rate-1794190000000",
    metric: "heart_rate",
    value: 72,
    unit: "bpm",
    measured_at: new Date(1794190000000).toISOString(),
    received_at: new Date(now).toISOString()
  });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body, {
    ok: true,
    duplicate: false,
    sampleId: "heart_rate-1794190000000",
    receivedAt: now
  });
});

test("upserts daily step totals by sample ID", async () => {
  const now = 1794190600000;
  const sample = {
    sampleId: "steps-2026-11-11",
    metric: "steps",
    value: 1850,
    unit: "steps",
    measuredAt: now
  };
  const requests = [];
  const handler = createHandler({
    env,
    now: () => now,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: requests.length === 1 ? 201 : 200,
        json: async () => [
          {
            sample_id: sample.sampleId,
            received_at: new Date(now).toISOString()
          }
        ]
      };
    }
  });

  const inserted = createResponse();
  await handler({ method: "POST", body: sample }, inserted);
  assert.equal(inserted.statusCode, 201);
  assert.equal(inserted.body.updated, false);

  const updated = createResponse();
  await handler({ method: "POST", body: sample }, updated);
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.updated, true);
  assert.equal(
    requests[0].url,
    "https://example.supabase.co/rest/v1/samples?on_conflict=sample_id"
  );
  assert.equal(
    requests[0].options.headers.Prefer,
    "resolution=merge-duplicates,return=representation"
  );
  assert.equal(requests.length, 2);
});

test("acknowledges duplicate sample IDs without adding another row", async () => {
  const handler = createHandler({
    env,
    fetchImpl: async () => ({
      ok: false,
      status: 409,
      json: async () => ({ code: "23505", message: "duplicate key" })
    })
  });
  const response = createResponse();

  await handler({ method: "POST", body: createSample() }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    duplicate: true,
    sampleId: "heart_rate-1794190000000"
  });
});

test("rejects invalid samples without contacting Supabase", async () => {
  let fetchCalled = false;
  const handler = createHandler({
    env,
    fetchImpl: async () => {
      fetchCalled = true;
    }
  });
  const response = createResponse();

  await handler({
    method: "POST",
    body: { ...createSample(), value: -1 }
  }, response);

  assert.equal(fetchCalled, false);
  assert.equal(response.statusCode, 400);
});

test("returns a configuration error when Supabase secrets are missing", async () => {
  const handler = createHandler({ env: {}, fetchImpl: async () => {} });
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await handler({ method: "POST", body: createSample() }, response);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.ok, false);
});

test("rejects methods other than POST", async () => {
  const handler = createHandler({ env, fetchImpl: async () => {} });
  const response = createResponse();

  await handler({ method: "GET" }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "POST");
});

test("reports a database connection failure without claiming success", async () => {
  const handler = createHandler({
    env,
    fetchImpl: async () => {
      throw new Error("connection refused");
    }
  });
  const response = createResponse();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await handler({ method: "POST", body: createSample() }, response);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 502);
  assert.deepEqual(response.body, {
    ok: false,
    error: "Could not reach the sample database."
  });
});
