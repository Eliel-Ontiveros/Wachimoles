// Báscula que se anuncia como "Yoda1" (app OKOK International).
// Payload de 15 bytes en los datos de fabricante, observado en capturas reales:
//
//   [0]    0xc0            cabecera fija
//   [1]    uint8           contador de pesajes: sube en 1 cada vez que la báscula
//                          se despierta (observado 5, 6, 7, 8 en pesajes seguidos)
//   [2-3]  uint16 BE       peso en centésimas de kg  (0x02b2 = 690 = 6.90 kg,
//                          la pantalla de la báscula marcó 6.9)
//   [4-5]  uint16 BE       0x1388 (5000) cuando hay peso; 0 en reposo. Idéntico con
//                          manos, con calcetines y descalzo: NO es impedancia útil.
//   [8]    0x24 | 0x25     0x25 cuando hay peso; 0x24 en reposo
//   resto  ceros
//
// Verificado contra la pantalla: el peso. El contador se deduce de varias
// capturas consecutivas. [4-5] sigue en 5000 también descalzo.
const PAYLOAD_LENGTH = 15;
const HEADER = 0xc0;

function decode({ manufacturerData } = {}) {
  if (
    !Buffer.isBuffer(manufacturerData) ||
    manufacturerData.length !== PAYLOAD_LENGTH ||
    manufacturerData[0] !== HEADER
  ) {
    return null;
  }

  return {
    weightKg: manufacturerData.readUInt16BE(2) / 100,
    sequence: manufacturerData[1]
  };
}

module.exports = { decode, PAYLOAD_LENGTH };
