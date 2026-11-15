// Herramienta de captura: muestra los anuncios BLE crudos de la báscula para
// poder identificar el formato. Súbete a la báscula mientras corre y guarda la
// salida (npm run scan | tee captura.log).
//
// macOS: la terminal necesita permiso de Bluetooth
// (Ajustes del Sistema > Privacidad y seguridad > Bluetooth).
const { SCALE_NAME, SCALE_ID } = require("./config");

let noble;
try {
  noble = require("@abandonware/noble");
} catch {
  console.error("Falta @abandonware/noble. Ejecuta `npm install` en Wachimoles_Bascula.");
  process.exit(1);
}

const showAll = process.argv.includes("--all");
// --diff: 15 s de línea base sin tocar la báscula; después solo se imprimen
// dispositivos que NO estaban en la base (la báscula empieza a emitir al
// subirte). Se omiten los anuncios de Apple (0x004c), que rotan de dirección.
const diffMode = process.argv.includes("--diff");
const BASELINE_SECONDS = 15;
const baselineIds = new Set();
let baselineDone = !diffMode;
if (diffMode) {
  console.error(`Línea base: NO te subas a la báscula durante ${BASELINE_SECONDS} s...`);
  setTimeout(() => {
    baselineDone = true;
    console.error(">>> AHORA súbete a la báscula y quédate encima hasta que se estabilice <<<");
  }, BASELINE_SECONDS * 1000);
}
// En modo --all solo se imprime un dispositivo cuando cambia su payload, para
// que se vea cuál se mueve al subirte a la báscula.
const lastSeen = new Map();

noble.on("stateChange", (state) => {
  if (state === "poweredOn") {
    console.error("Escaneando... (Ctrl+C para salir)");
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
    console.error(`Bluetooth: ${state}`);
  }
});

noble.on("discover", (peripheral) => {
  const { localName, manufacturerData, serviceData } = peripheral.advertisement;
  if (diffMode) {
    if (!baselineDone) {
      baselineIds.add(peripheral.id);
      return;
    }
    const isApple =
      manufacturerData && manufacturerData.length >= 2 && manufacturerData.readUInt16LE(0) === 0x004c;
    if (baselineIds.has(peripheral.id) || isApple) {
      return;
    }
  }

  const matches =
    (SCALE_ID && peripheral.id === SCALE_ID) ||
    (localName && localName.includes(SCALE_NAME));

  if (!showAll && !diffMode && !matches) {
    return;
  }

  const entry = {
    t: new Date().toISOString(),
    id: peripheral.id,
    name: localName || null,
    rssi: peripheral.rssi,
    connectable: peripheral.connectable,
    manufacturerData: manufacturerData ? manufacturerData.toString("hex") : null,
    serviceData: (serviceData || []).map((s) => ({
      uuid: s.uuid,
      data: s.data.toString("hex")
    }))
  };

  const fingerprint = JSON.stringify([entry.name, entry.manufacturerData, entry.serviceData]);
  if (lastSeen.get(peripheral.id) === fingerprint) {
    return;
  }
  lastSeen.set(peripheral.id, fingerprint);

  console.log(JSON.stringify(entry));
});
