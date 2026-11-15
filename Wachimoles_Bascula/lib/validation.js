const MAX_WEIGHT_KG = 500;

// Payload: { measurementId: "weight-<epoch ms>", weightKg, measuredAt, device? }
function isValidMeasurement(m) {
  return (
    !!m &&
    typeof m.measurementId === "string" &&
    /^weight-\d+$/.test(m.measurementId) &&
    m.measurementId.length <= 120 &&
    typeof m.weightKg === "number" &&
    Number.isFinite(m.weightKg) &&
    m.weightKg > 0 &&
    m.weightKg <= MAX_WEIGHT_KG &&
    Number.isSafeInteger(m.measuredAt) &&
    m.measuredAt > 0 &&
    Number.isFinite(new Date(m.measuredAt).getTime()) &&
    (m.device === undefined ||
      (typeof m.device === "string" && m.device.length <= 80))
  );
}

module.exports = { isValidMeasurement, MAX_WEIGHT_KG };
