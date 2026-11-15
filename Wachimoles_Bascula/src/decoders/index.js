// Un decodificador convierte el payload BLE de un anuncio en { weightKg } o
// null si el paquete no es una lectura de peso.
//
//   decode({ manufacturerData: Buffer, localName: string, serviceData: [...] })
const decoders = {};

function registerDecoder(name, fn) {
  decoders[name] = fn;
}

function getDecoder(name) {
  const decoder = decoders[name];
  if (!decoder) {
    throw new Error(
      `No hay decodificador "${name}". Disponibles: ${Object.keys(decoders).join(", ")}.`
    );
  }
  return decoder;
}

registerDecoder("yoda1", require("./yoda1").decode);

module.exports = { registerDecoder, getDecoder };
