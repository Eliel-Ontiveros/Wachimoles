// Carga el perfil corporal del usuario activo por el propio backend
// (PUT /dashboard/body-profile). Solo la estatura es obligatoria.
//
//   npm run body-profile -- --height 177
//   npm run body-profile -- --height 177 --age 25 --sex male
//
// Lee DASHBOARD_API_TOKEN (y opcionalmente BACKEND_URL, por defecto
// http://localhost:3000) del entorno o del .env. El token no se imprime.
// PUT reemplaza el perfil: lo que no se indique (edad, sexo) queda en null.
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    height: { type: "string" },
    age: { type: "string" },
    sex: { type: "string" }
  }
});

const token = process.env.DASHBOARD_API_TOKEN;
const baseUrl = (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/+$/, "");

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!token) fail("Falta DASHBOARD_API_TOKEN (usa `npm run body-profile`, que carga el .env).");
if (!values.height) fail("Falta --height <cm>. Ejemplo: --height 177");

const body = { heightCm: Number(values.height) };
if (!Number.isFinite(body.heightCm)) fail("--height debe ser un número.");
if (values.age !== undefined) {
  body.ageYears = Number(values.age);
  if (!Number.isInteger(body.ageYears)) fail("--age debe ser un entero.");
}
if (values.sex !== undefined) {
  if (!["male", "female"].includes(values.sex)) fail('--sex debe ser "male" o "female".');
  body.sex = values.sex;
}

let response;
try {
  response = await fetch(`${baseUrl}/dashboard/body-profile`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
} catch (error) {
  fail(`No se pudo conectar con el backend en ${baseUrl} (${error.cause?.code ?? error.message}). ¿Está corriendo \`npm run start:dev\`?`);
}
const text = await response.text();
if (!response.ok) fail(`El backend respondió ${response.status}: ${text}`);
console.log("Perfil guardado:", text);
