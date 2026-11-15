// URL del endpoint propio de la báscula, por ejemplo
// https://<proyecto-vercel-bascula>.vercel.app/api/weights
const SCALE_API_URL = process.env.SCALE_API_URL || "";
// Clave compartida con SCALE_API_KEY del servidor (no se guarda en el repo).
const SCALE_API_KEY = process.env.SCALE_API_KEY || "";

// La báscula del equipo se anuncia como "Yoda1" (visto en la captura del 2026-11-14).
const SCALE_NAME = process.env.SCALE_NAME || "Yoda1";
const SCALE_ID = process.env.SCALE_ID || null;

const MIN_SECONDS_BETWEEN_UPLOADS = Number(process.env.MIN_SECONDS_BETWEEN_UPLOADS || 10);

module.exports = { SCALE_API_URL, SCALE_API_KEY, SCALE_NAME, SCALE_ID, MIN_SECONDS_BETWEEN_UPLOADS };
