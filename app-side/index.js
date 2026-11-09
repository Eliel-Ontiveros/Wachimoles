import { BaseSideService } from "@zeppos/zml/base/base-side";
import { messagingPlugin } from "@zeppos/zml/2.0/module/messaging/plugin/side";
import { SAMPLE_API_URL } from "./config";

BaseSideService.use(messagingPlugin);

function parseResponseBody(body) {
  const parsed = typeof body === "string" ? JSON.parse(body) : body;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("El servidor devolvió una respuesta vacía o inválida.");
  }

  return parsed;
}

function validateSample(sample) {
  if (
    !sample ||
    typeof sample.sampleId !== "string" ||
    sample.sampleId.length === 0 ||
    sample.sampleId.length > 120 ||
    typeof sample.value !== "number" ||
    !Number.isFinite(sample.value) ||
    !Number.isSafeInteger(sample.measuredAt) ||
    sample.measuredAt <= 0
  ) {
    return false;
  }

  if (sample.metric === "heart_rate") {
    return sample.value > 0 && sample.value <= 250 && sample.unit === "bpm";
  }

  if (sample.metric === "spo2") {
    return sample.value > 0 && sample.value <= 100 && sample.unit === "%";
  }

  if (sample.metric === "stress") {
    return sample.value >= 0 && sample.unit === "score";
  }

  return false;
}

AppSideService(
  BaseSideService({
    async onRequest(request, respond) {
      if (!request || request.type !== "UPLOAD_SAMPLE") {
        respond(null, {
          ok: false,
          error: "Tipo de solicitud no reconocido."
        });
        return;
      }

      const sample = request.params;
      if (!validateSample(sample)) {
        respond(null, {
          ok: false,
          error: "La muestra fisiológica no es válida."
        });
        return;
      }

      if (SAMPLE_API_URL.indexOf("REPLACE_WITH_PC_LAN_IP") !== -1) {
        respond(null, {
          ok: false,
          error: "Configura la IP local del servidor en app-side/config.js."
        });
        return;
      }

      try {
        const response = await fetch({
          url: SAMPLE_API_URL,
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(sample)
        });
        const result = parseResponseBody(response.body);

        if (result.ok !== true) {
          throw new Error(result.error || "El servidor rechazó la muestra.");
        }

        respond(null, {
          ok: true,
          duplicate: result.duplicate === true,
          receivedAt: result.receivedAt
        });
      } catch (error) {
        console.error("Sample upload failed:", error);
        respond(null, {
          ok: false,
          error: error && error.message
            ? error.message
            : "No se pudo enviar la muestra."
        });
      }
    }
  })
);
