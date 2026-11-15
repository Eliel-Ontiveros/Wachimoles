const { timingSafeEqual } = require("node:crypto");
const { isValidMeasurement } = require("../lib/validation");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function keysMatch(received, expected) {
  const a = Buffer.from(String(received || ""));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseBody(body) {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function createHandler({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  return async function weightsHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      response.status(405).json({ ok: false, error: "Method not allowed." });
      return;
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DASHBOARD_USER_ID, SCALE_API_KEY } = env;
    let projectUrl = null;
    try {
      projectUrl = new URL(SUPABASE_URL);
    } catch {
      projectUrl = null;
    }
    if (
      !projectUrl ||
      projectUrl.protocol !== "https:" ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !UUID_RE.test(DASHBOARD_USER_ID || "") ||
      !SCALE_API_KEY ||
      SCALE_API_KEY.length < 24
    ) {
      console.error("Scale API environment is not configured.");
      response.status(500).json({ ok: false, error: "The service is not configured." });
      return;
    }

    // A diferencia de /api/samples, aquí se exige una clave compartida.
    if (!keysMatch(request.headers && request.headers["x-api-key"], SCALE_API_KEY)) {
      response.status(401).json({ ok: false, error: "Unauthorized." });
      return;
    }

    const measurement = parseBody(request.body);
    if (!isValidMeasurement(measurement)) {
      response.status(400).json({ ok: false, error: "Expected a valid weight measurement." });
      return;
    }

    const row = {
      user_id: DASHBOARD_USER_ID,
      measurement_id: measurement.measurementId,
      weight_kg: measurement.weightKg,
      measured_at: new Date(measurement.measuredAt).toISOString(),
      received_at: new Date(now()).toISOString()
    };
    if (measurement.device !== undefined) {
      row.device = measurement.device;
    }

    let databaseResponse;
    try {
      databaseResponse = await fetchImpl(`${projectUrl.origin}/rest/v1/weight_measurements`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(row)
      });
    } catch (error) {
      console.error("Supabase request failed:", error.message);
      response.status(502).json({ ok: false, error: "Could not reach the database." });
      return;
    }

    let result = null;
    try {
      result = await databaseResponse.json();
    } catch {
      result = null;
    }

    // measurement_id repetido: un reintento del mismo pesaje, no es un error.
    if (databaseResponse.status === 409 && result && result.code === "23505") {
      response.status(200).json({ ok: true, duplicate: true, measurementId: measurement.measurementId });
      return;
    }

    if (!databaseResponse.ok) {
      console.error("Supabase insert failed:", result && result.code, result && result.message);
      response.status(502).json({ ok: false, error: "Could not persist measurement." });
      return;
    }

    const record = Array.isArray(result) ? result[0] : null;
    if (!record || !record.received_at) {
      response.status(502).json({ ok: false, error: "The database did not confirm persistence." });
      return;
    }

    response.status(201).json({
      ok: true,
      duplicate: false,
      measurementId: record.measurement_id,
      receivedAt: Date.parse(record.received_at)
    });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
