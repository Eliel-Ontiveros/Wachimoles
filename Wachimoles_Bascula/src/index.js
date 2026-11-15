// Lee la báscula por BLE y envía cada pesaje estable a la API de WachiMoles.
const { SCALE_NAME, SCALE_ID, MIN_SECONDS_BETWEEN_UPLOADS } = require("./config");
const { getDecoder } = require("./decoders");
const { createWeighingFilter } = require("./weighing-filter");
const { buildMeasurement } = require("./measurement");
const { uploadMeasurement } = require("./uploader");

const DRY_RUN = process.argv.includes("--dry-run");
const DECODER_NAME = process.env.SCALE_DECODER || "yoda1";

let noble;
try {
  noble = require("@abandonware/noble");
} catch {
  console.error("Falta @abandonware/noble. Ejecuta `npm install` en Wachimoles_Bascula.");
  process.exit(1);
}

const decode = getDecoder(DECODER_NAME);
const filter = createWeighingFilter({ minSecondsBetween: MIN_SECONDS_BETWEEN_UPLOADS });

noble.on("stateChange", (state) => {
  if (state === "poweredOn") {
    console.log(`Esperando pesajes de "${SCALE_NAME}"${DRY_RUN ? " (dry-run: no se envía nada)" : ""}...`);
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
    console.error(`Bluetooth: ${state}`);
  }
});

noble.on("discover", async (peripheral) => {
  const { localName, manufacturerData, serviceData } = peripheral.advertisement;
  const matches =
    (SCALE_ID && peripheral.id === SCALE_ID) ||
    (localName && localName.includes(SCALE_NAME));
  if (!matches) {
    return;
  }

  const reading = decode({ manufacturerData, serviceData, localName });
  const weighing = reading && filter.accept(reading, Date.now());
  if (!weighing) {
    return;
  }

  try {
    const measurement = buildMeasurement(weighing.weightKg, weighing.measuredAt);
    if (DRY_RUN) {
      console.log(`[dry-run] ${measurement.weightKg} kg -> ${measurement.measurementId} (no se envió)`);
      return;
    }
    const result = await uploadMeasurement(measurement);
    console.log(
      `${measurement.weightKg} kg enviado${result.duplicate ? " (duplicado)" : ""} -> ${measurement.measurementId}`
    );
  } catch (error) {
    console.error(`No se pudo enviar el pesaje: ${error.message}`);
  }
});
