// La báscula emite anuncios continuamente. Reglas para decidir cuándo hay un
// pesaje que enviar:
//  - el peso debe ser > 0 y repetirse idéntico en `repeats` anuncios seguidos
//    (descarta valores intermedios mientras alguien se sube);
//  - un pesaje se envía una sola vez: se identifica por (contador, peso), así
//    que dos pesajes seguidos con el mismo peso sí se envían los dos, y un
//    mismo pesaje no se reenvía mientras la báscula lo siga mostrando;
//  - nunca dos envíos con menos de `minSecondsBetween` de diferencia.
function createWeighingFilter({ repeats = 3, minSecondsBetween = 10 } = {}) {
  let candidate = null;
  let candidateCount = 0;
  let sentKey = null;
  let lastUploadAt = -Infinity;

  return {
    accept(reading, now) {
      const weight = reading && reading.weightKg;

      if (!(weight > 0)) {
        // Sin peso: se rearma para el siguiente pesaje.
        candidate = null;
        candidateCount = 0;
        sentKey = null;
        return null;
      }

      const key = `${reading.sequence === undefined ? "" : reading.sequence}:${weight}`;

      if (key === candidate) {
        candidateCount += 1;
      } else {
        candidate = key;
        candidateCount = 1;
      }

      if (
        candidateCount < repeats ||
        key === sentKey ||
        now - lastUploadAt < minSecondsBetween * 1000
      ) {
        return null;
      }

      sentKey = key;
      lastUploadAt = now;
      return { weightKg: weight, measuredAt: now };
    }
  };
}

module.exports = { createWeighingFilter };
