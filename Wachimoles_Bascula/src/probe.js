// Sonda de solo lectura: se conecta a la báscula mientras está despierta, lista
// sus servicios y registra todo lo que notifique, para saber si la impedancia
// (grasa, músculo, agua...) llega por conexión y no por el anuncio.
//
// NO escribe nada en la báscula: solo lee y se suscribe a notificaciones.
// Uso: npm run probe 2>&1 | tee captura-probe.log
//   1) Bluetooth del teléfono apagado, app OKOK cerrada.
//   2) Ejecuta el comando, súbete DESCALZO y quédate quieto ~30 s.
//   3) La sonda se conecta sola en cuanto la báscula despierta.
const { SCALE_NAME, SCALE_ID } = require("./config");

let noble;
try {
  noble = require("@abandonware/noble");
} catch {
  console.error("Falta @abandonware/noble. Ejecuta `npm install` en Wachimoles_Bascula.");
  process.exit(1);
}

const log = (obj) => console.log(JSON.stringify({ t: new Date().toISOString(), ...obj }));
const CONNECT_TIMEOUT_MS = 15000;
let busy = false;
let reportedNotConnectable = false;

noble.on("stateChange", (state) => {
  if (state === "poweredOn") {
    console.error(`Esperando a "${SCALE_NAME}"... súbete a la báscula. (Ctrl+C para salir)`);
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
    console.error(`Bluetooth: ${state}`);
  }
});

noble.on("discover", async (peripheral) => {
  const { localName } = peripheral.advertisement;
  const matches =
    (SCALE_ID && peripheral.id === SCALE_ID) || (localName && localName.includes(SCALE_NAME));
  if (!matches || busy) {
    return;
  }

  // peripheral.connectable viene del propio anuncio (kCBAdvDataIsConnectable en
  // macOS). Si es false, la báscula es un emisor puro y no acepta conexiones.
  if (peripheral.connectable === false && !process.env.FORCE_CONNECT) {
    if (!reportedNotConnectable) {
      reportedNotConnectable = true;
      log({
        event: "not-connectable",
        id: peripheral.id,
        note: "La báscula anuncia que NO acepta conexiones; no se intenta conectar. Usa FORCE_CONNECT=1 para forzar."
      });
    }
    return;
  }

  busy = true;
  noble.stopScanning();
  log({
    event: "connecting",
    id: peripheral.id,
    name: localName,
    rssi: peripheral.rssi,
    connectable: peripheral.connectable
  });

  const finish = () => {
    busy = false;
    log({ event: "resume-scan" });
    noble.startScanning([], true);
  };

  peripheral.once("disconnect", () => {
    log({ event: "disconnected" });
    finish();
  });

  try {
    await Promise.race([
      peripheral.connectAsync(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`sin respuesta tras ${CONNECT_TIMEOUT_MS / 1000} s`)), CONNECT_TIMEOUT_MS)
      )
    ]);
    log({ event: "connected" });

    const { services, characteristics } = await peripheral.discoverAllServicesAndCharacteristicsAsync();
    log({ event: "services", services: services.map((s) => s.uuid) });

    for (const c of characteristics) {
      log({ event: "characteristic", uuid: c.uuid, properties: c.properties });

      if (c.properties.includes("read")) {
        try {
          const value = await c.readAsync();
          log({ event: "read", uuid: c.uuid, hex: value.toString("hex") });
        } catch (error) {
          log({ event: "read-error", uuid: c.uuid, error: error.message });
        }
      }

      if (c.properties.includes("notify") || c.properties.includes("indicate")) {
        c.on("data", (data) => log({ event: "notify", uuid: c.uuid, hex: data.toString("hex") }));
        try {
          await c.subscribeAsync();
          log({ event: "subscribed", uuid: c.uuid });
        } catch (error) {
          log({ event: "subscribe-error", uuid: c.uuid, error: error.message });
        }
      }
    }
  } catch (error) {
    log({ event: "error", error: error.message });
    try {
      await peripheral.disconnectAsync();
    } catch {
      // ya desconectada
    }
    if (busy) {
      finish();
    }
  }
});
