const { SCALE_API_URL, SCALE_API_KEY } = require("./config");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST de un pesaje a /api/weights. La API responde { ok, duplicate, ... }.
// Reintenta ante fallos de red o 5xx (la API devuelve 502 si Supabase falla).
async function uploadMeasurement(
  measurement,
  { url = SCALE_API_URL, apiKey = SCALE_API_KEY, fetchImpl = globalThis.fetch, retries = 3, retryDelayMs = 1000 } = {}
) {
  if (!url || !apiKey) {
    throw new Error("Define SCALE_API_URL y SCALE_API_KEY.");
  }
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(measurement)
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (response.ok && body && body.ok === true) {
        return { duplicate: body.duplicate === true, receivedAt: body.receivedAt };
      }

      const message = (body && body.error) || `HTTP ${response.status}`;
      // 4xx: la muestra es inválida, reintentar no ayuda.
      if (response.status >= 400 && response.status < 500) {
        throw Object.assign(new Error(message), { retryable: false });
      }
      lastError = new Error(message);
    } catch (error) {
      if (error.retryable === false) {
        throw error;
      }
      lastError = error;
    }

    if (attempt < retries) {
      await sleep(retryDelayMs * 2 ** attempt);
    }
  }

  throw lastError;
}

module.exports = { uploadMeasurement };
