const { isValidMeasurement } = require("../lib/validation");

function buildMeasurement(weightKg, measuredAt = Date.now(), device = "okok-scale") {
  const measurement = {
    measurementId: `weight-${measuredAt}`,
    // La báscula entrega décimas de kg; se evita ruido de coma flotante.
    weightKg: Math.round(weightKg * 100) / 100,
    measuredAt,
    device
  };
  if (!isValidMeasurement(measurement)) {
    throw new Error(`Peso inválido: ${weightKg} kg`);
  }
  return measurement;
}

module.exports = { buildMeasurement };
