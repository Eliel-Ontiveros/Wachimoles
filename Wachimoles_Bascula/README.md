# Báscula Bluetooth OKOK → backend

Módulo **independiente**: no modifica ni depende de `Wachimoles_Reloj`, el backend
NestJS ni las apps. Lee el peso de una báscula de la app OKOK International
(se anuncia por Bluetooth como `Chipsea-BLE`) y lo guarda en Supabase por medio
de su propio endpoint y su propia tabla.

```
Báscula (BLE) → src/index.js (Mac/Raspberry) → POST /api/weights (Vercel) → public.weight_measurements
```

Sigue las mismas convenciones que el reloj: API serverless en Vercel con la
`service_role` solo en el servidor, propietario asignado por `DASHBOARD_USER_ID`,
id único por muestra para que los reintentos no dupliquen filas, y el mismo
formato de fecha (epoch ms → `timestamptz` UTC).

## Diferencias deliberadas con el reloj

- **Tabla propia** `weight_measurements` (`weight_kg`, `measured_at`,
  `received_at`, `device`), sin tocar las restricciones de `public.samples`.
- **El endpoint exige clave** (`x-api-key` = `SCALE_API_KEY`, mínimo 24
  caracteres). Si no está configurada, responde 500 y no guarda nada.
- El peso se guarda como **masa en kg tal como la reporta la báscula**; masa vs
  peso-fuerza en otros entornos de gravedad (BACKLOG D1) sigue pendiente.

## Puesta en marcha

1. **Supabase**: ejecuta `supabase/schema.sql` en el SQL Editor.
2. **Vercel**: despliega esta carpeta como un proyecto aparte
   (`npx vercel` dentro de `Wachimoles_Bascula`) con las variables
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DASHBOARD_USER_ID` (mismos
   valores que el reloj) y `SCALE_API_KEY` (genera una con
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`).
   Comprobación: `https://<dominio>/api/health`.
3. **Probar la báscula sin enviar nada** (con el Bluetooth del teléfono
   apagado y la app OKOK cerrada, para que no se quede con la báscula):
   ```bash
   npm install
   npm run dry-run
   ```
   Súbete y espera a que el número se estabilice: debe imprimir una línea
   `[dry-run] <peso> kg` por pesaje. No requiere Vercel ni Supabase.
4. **Enviar a la API**:
   ```bash
   SCALE_API_URL=https://<dominio>/api/weights SCALE_API_KEY=<clave> npm start
   ```
   Opcionales: `SCALE_ID`, `SCALE_NAME` (por defecto `Yoda1`),
   `SCALE_DECODER` (por defecto `yoda1`), `MIN_SECONDS_BETWEEN_UPLOADS`.

## Formato de la báscula (observado)

La báscula se anuncia como `Yoda1` y manda el peso en los datos de fabricante
del anuncio, sin conexión. Detalle en `src/decoders/yoda1.js`. Verificado contra
la pantalla: bytes 2-3 (uint16 big-endian) = peso en centésimas de kg
(`02 b2` = 690 → 6.9 kg). El byte 1 es un contador que sube en cada pesaje
(5, 6, 7, 8 en pesajes seguidos) y sirve para no duplicar. Con calcetines, los
bytes 4-5 siguen en 5000: parece ser "sin impedancia" (falta probar descalzo).

Descalzo, con calcetines y con las manos el anuncio trae el mismo 5000 en los
bytes 4-5: el anuncio **no** incluye la impedancia. Además, `npm run probe`
confirmó (2026-11-14) que la báscula anuncia `connectable = false`: es un emisor
puro y no acepta conexiones. Conclusión: **por Bluetooth solo se obtiene el
peso**. Grasa, músculo, agua, visceral, etc. no se pueden leer de la báscula;
las alternativas son estimarlos a partir de peso/estatura/edad/sexo (marcados
como estimados) o cargarlos a mano desde la app OKOK.
Pendiente: comportamiento si la báscula está configurada en lb.

Herramienta de captura, si hace falta volver a analizar: `npm run scan -- --all`
(muestra cada dispositivo cuando cambia su payload). `--diff` oculta lo que ya
estaba emitiendo durante sus 15 s de línea base.

## Pruebas

```bash
npm test
```

## Integración con el backend NestJS

Los pesajes quedan asociados al mismo usuario activo que las métricas del reloj
(`DASHBOARD_USER_ID`). El backend los expone en `GET /dashboard/weights` junto
con indicadores derivados, y guarda el perfil del usuario (estatura, edad, sexo)
en `PUT /dashboard/body-profile`; ver el README de `Wachimoles_Backend`. La tabla
`weight_measurements` también la crea la migración
`20261114_add_weight_measurements_and_body_profile.sql` del backend (mismo
esquema que `supabase/schema.sql`, que es idempotente: puedes ejecutar solo una
de las dos).

Los indicadores `exact` (IMC, rangos, peso ideal) coinciden con los de la app
OKOK. Los `estimated` (grasa, agua, metabolismo) son fórmulas de población y
salen cerca, no iguales, a la app. Músculo esquelético, grasa visceral, masa
ósea y proteína no se calculan: dependen de la impedancia y de la fórmula
privada de OKOK.

## Límites

- `@abandonware/noble` no se pudo instalar ni probar en el entorno de
  desarrollo; revisa que compile en tu Mac.
- Solo se envía el peso; grasa, agua u otros valores no se importan hasta
  comprobar qué datos entrega realmente la báscula.
- No hay cola sin conexión: un pesaje sin red tras los reintentos se pierde.
