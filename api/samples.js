const { isValidSample } = require("../server/sample-validation");
const TIME_OFFSET_MS = 8 * 60 * 60 * 1000;

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

function parseBody(body) {
  if (typeof body !== "string") {
    return body;
  }

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
  return async function samplesHandler(request, response) {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      sendJson(response, 405, { ok: false, error: "Method not allowed." });
      return;
    }

    const sample = parseBody(request.body);
    if (!isValidSample(sample)) {
      sendJson(response, 400, {
        ok: false,
        error: "Expected a valid heart-rate, SpO2, stress, or steps sample."
      });
      return;
    }

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase server environment is not configured.");
      sendJson(response, 500, {
        ok: false,
        error: "The sample database is not configured."
      });
      return;
    }

    let projectUrl;
    try {
      projectUrl = new URL(SUPABASE_URL);
    } catch {
      console.error("SUPABASE_URL is invalid.");
      sendJson(response, 500, {
        ok: false,
        error: "The sample database is not configured."
      });
      return;
    }

    if (projectUrl.protocol !== "https:") {
      console.error("SUPABASE_URL must use HTTPS.");
      sendJson(response, 500, {
        ok: false,
        error: "The sample database is not configured."
      });
      return;
    }

    const measuredAt = new Date(sample.measuredAt - TIME_OFFSET_MS).toISOString();
    const databaseSample = {
      sample_id: sample.sampleId,
      metric: sample.metric,
      value: sample.value,
      unit: sample.unit,
      measured_at: measuredAt,
      received_at: new Date(now() - TIME_OFFSET_MS).toISOString()
    };
    if (sample.sensorTime !== undefined) {
      databaseSample.sensor_time = sample.sensorTime;
    }

    let databaseResponse;
    try {
      databaseResponse = await fetchImpl(
        `${projectUrl.origin}/rest/v1/samples${
          sample.metric === "steps" ? "?on_conflict=sample_id" : ""
        }`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer:
              sample.metric === "steps"
                ? "resolution=merge-duplicates,return=representation"
                : "return=representation"
          },
          body: JSON.stringify(databaseSample)
        }
      );
    } catch (error) {
      console.error("Supabase request failed:", error.message);
      sendJson(response, 502, {
        ok: false,
        error: "Could not reach the sample database."
      });
      return;
    }

    let result;
    try {
      result = await databaseResponse.json();
    } catch {
      result = null;
    }

    if (
      databaseResponse.status === 409 &&
      result &&
      result.code === "23505"
    ) {
      sendJson(response, 200, {
        ok: true,
        duplicate: true,
        sampleId: sample.sampleId
      });
      return;
    }

    if (!databaseResponse.ok) {
      console.error(
        "Supabase insert failed:",
        result && result.code,
        result && result.message
      );
      sendJson(response, 502, {
        ok: false,
        error: "Could not persist sample."
      });
      return;
    }

    const record = Array.isArray(result) ? result[0] : null;
    if (!record || !record.received_at) {
      console.error("Supabase insert returned no persisted sample record.");
      sendJson(response, 502, {
        ok: false,
        error: "The sample database did not confirm persistence."
      });
      return;
    }

    const updatedSteps =
      sample.metric === "steps" && databaseResponse.status === 200;
    sendJson(response, updatedSteps ? 200 : 201, {
      ok: true,
      duplicate: false,
      ...(sample.metric === "steps" ? { updated: updatedSteps } : {}),
      sampleId: record.sample_id,
      receivedAt: Date.parse(record.received_at)
    });
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
