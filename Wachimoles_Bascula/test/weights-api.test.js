const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createHandler } = require("../api/weights");

const KEY = "s".repeat(32);
const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  DASHBOARD_USER_ID: "43235979-2b38-4a17-9a38-632484accad9",
  SCALE_API_KEY: KEY
};
const body = { measurementId: "weight-1794190000000", weightKg: 72.4, measuredAt: 1794190000000, device: "okok-scale" };

function res() {
  return {
    statusCode: null,
    body: null,
    setHeader() {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
}
const req = (over = {}) => ({ method: "POST", headers: { "x-api-key": KEY }, body, ...over });
const ok = async () => ({
  ok: true,
  status: 201,
  json: async () => [{ measurement_id: body.measurementId, received_at: new Date(1794190000000).toISOString() }]
});

test("stores a weight in weight_measurements with the server-side owner", async () => {
  let url, opts;
  const handler = createHandler({ env, fetchImpl: async (u, o) => { url = u; opts = o; return ok(); } });
  const r = res();
  await handler(req(), r);
  assert.equal(r.statusCode, 201);
  assert.equal(url, "https://example.supabase.co/rest/v1/weight_measurements");
  const row = JSON.parse(opts.body);
  assert.equal(row.user_id, env.DASHBOARD_USER_ID);
  assert.equal(row.weight_kg, 72.4);
});

test("rejects a missing or wrong api key without touching the database", async () => {
  const handler = createHandler({ env, fetchImpl: async () => { throw new Error("no DB"); } });
  for (const headers of [{}, { "x-api-key": "wrong" }]) {
    const r = res();
    await handler(req({ headers }), r);
    assert.equal(r.statusCode, 401);
  }
});

test("fails closed when the key is not configured", async () => {
  const handler = createHandler({ env: { ...env, SCALE_API_KEY: "" }, fetchImpl: ok });
  const r = res();
  await handler(req(), r);
  assert.equal(r.statusCode, 500);
});

test("rejects invalid weights and non-POST methods", async () => {
  const handler = createHandler({ env, fetchImpl: ok });
  for (const bad of [{ weightKg: 0 }, { weightKg: 501 }, { measurementId: "x" }]) {
    const r = res();
    await handler(req({ body: { ...body, ...bad } }), r);
    assert.equal(r.statusCode, 400);
  }
  const r = res();
  await handler(req({ method: "GET" }), r);
  assert.equal(r.statusCode, 405);
});

test("treats a repeated measurement_id as a duplicate", async () => {
  const handler = createHandler({
    env,
    fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ code: "23505" }) })
  });
  const r = res();
  await handler(req(), r);
  assert.equal(r.statusCode, 200);
  assert.equal(r.body.duplicate, true);
});
