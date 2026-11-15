# Backend de Wachimoles_Movil_Backend

The DeepSeek research assistant is documented in [the RAG setup guide](../docs/RAG.md).

API NestJS de solo lectura para el dashboard web independiente en
[`../Wachimoles_Movil_Frontend`](../Wachimoles_Movil_Frontend). Lee únicamente
el usuario configurado en `DASHBOARD_USER_ID`. La clave
`SUPABASE_SERVICE_ROLE_KEY` y el token privado de API solo viven en el servidor.
El endpoint SSE vuelve a consultar Supabase cada cinco segundos.

## Preparar Supabase

1. Asegúrate de que exista `public.samples` siguiendo el esquema de
   [`Wachimoles/supabase/schema.sql`](../Wachimoles/supabase/schema.sql).
2. Ejecuta
   `supabase/migrations/20261111_add_user_ownership_to_samples.sql` en el SQL
   Editor de Supabase.
3. Ejecuta
   `supabase/migrations/20261113_add_body_conditions.sql` para crear la tabla
   privada de padecimientos del cuerpo 3D.
4. Ejecuta
   `supabase/migrations/20261113_add_daily_health_checks.sql` para crear la
   tabla de cuestionarios médicos diarios.
5. Ejecuta
   `supabase/migrations/20261113_add_sleep_samples.sql` para permitir las
   muestras diarias de duración del sueño del reloj.
6. Ejecuta
   `supabase/migrations/20261114_add_weight_measurements_and_body_profile.sql`
   para crear `weight_measurements` (pesajes de la báscula Bluetooth, módulo
   `Wachimoles_Bascula`) y `user_body_profiles` (estatura del usuario activo y, opcionalmente,
   edad y sexo: entradas de las fórmulas corporales).
7. Las filas previas y las que siga insertando el endpoint actual del reloj
   tendrán `user_id` nulo. La API las excluye. Asigna cada fila al usuario fijo
   solo después de comprobar que le pertenece.

## Configuración y ejecución local

Requiere Node.js 20 o posterior. Desde `Wachimoles_Movil_Backend`:

```powershell
npm install
Copy-Item .env.example .env
```

Completa `.env` con:

- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: clave secreta nueva del proyecto, guardada solo
  en el servidor.
- `SUPABASE_STORAGE_BUCKET`: ID exacto del bucket de imágenes en Storage. No es
  una clave API; usa el identificador del bucket que aparece en Supabase.
- `DASHBOARD_USER_ID`: UUID del usuario fijo. Lo encuentras en Supabase en
  **Authentication → Users**.
- `DASHBOARD_API_TOKEN`: secreto aleatorio de al menos 32 caracteres para las
  llamadas servidor-a-servidor de la API. No se incluye en el frontend web.
- `DASHBOARD_WEB_PASSWORD`: contraseña independiente de al menos 16 caracteres
  para consultar el dashboard web. El usuario es `dashboard`.
- `DEEPSEEK_API_KEY` (optional): enables `POST /voice/interpret`, which turns
  free-form voice phrases into app actions with DeepSeek. Without it the
  endpoint returns 503 and the app uses only the local interpreter. Optional:
  `DEEPSEEK_MODEL` (default `deepseek-chat`) and `DEEPSEEK_BASE_URL`.
- `CORS_ORIGINS`: debe incluir el origen del frontend, por defecto
  `http://localhost:5173`.

Genera un token aleatorio en PowerShell (repite el comando para cada secreto):

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

No uses el UUID como protección ni compartas la clave service-role. Si una clave
`sb_secret_...` ya fue expuesta, revócala y genera otra antes de guardarla en
`.env`. Luego:

```powershell
npm run start:dev
npm test
npm run build
```

`CORS_ORIGINS` es una lista opcional de orígenes web separados por comas. Las
solicitudes nativas pueden omitir el encabezado `Origin`; los navegadores solo
pueden usar los orígenes configurados.

## Frontend independiente

El backend expone `GET /dashboard/data?limit=500` con autenticación HTTP Basic.
El frontend envía el usuario `dashboard` y la contraseña configurada en
`DASHBOARD_WEB_PASSWORD`; esta contraseña se mantiene en memoria en el
navegador y no se guarda en `localStorage`.

Inicia la interfaz desde `Wachimoles_Movil_Frontend` en otra terminal:

```powershell
npm install
npm run dev
```

Abre la URL que muestra Vite (por defecto `http://localhost:5173`). La página
muestra las mediciones recientes, una gráfica por métrica y se actualiza cada
30 segundos. Configura `VITE_API_BASE_URL` en el `.env` del frontend si el
backend no está en `http://localhost:3000`. En producción, agrega el origen del
frontend a `CORS_ORIGINS` y publica ambos servicios detrás de HTTPS.

## API

- `GET /health` — estado del proceso, sin autenticación.
- `POST /voice/interpret` `{ "text": "...", "history"?: [{ "role": "user"|"assistant", "content": "≤300" }] (max. 6), "context"?: { "screen": "/"|"/explore"|"/missions", "tab"?: "body"|"health"|"records" }, "locale"?: "es"|"en" }` — private token. `context` is the user's current screen/tab: the prompt (generated from the catalog in `src/voice/voice-catalog.ts`) uses it to prefer actions from that screen when the phrase is ambiguous; other keys are rejected (400). The user may speak Spanish or English (both are understood), but the `message` is ALWAYS in English. `locale` is still accepted so older clients do not get a 400, but it is ignored. Returns
  `{ intent, message? }` with an action from the app whitelist (DeepSeek). `fill-health-check` symptoms are normalized to English (`None`, `Zero-G dizziness`, `Congestion`, `Fatigue`, `Headache`); legacy Spanish values (`Ninguno`, `Mareo 0g`, `Congestión`, `Fatiga`, `Cefalea`) are accepted too.
- `GET /dashboard/samples?limit=100&metric=heart_rate` — hasta 500 muestras
  del usuario fijo; `metric` puede ser `heart_rate`, `stress`, `spo2` o
  `steps` o `sleep`.
- `GET /dashboard/samples/stream?limit=100` — envía una instantánea inicial y
  nuevas instantáneas mediante SSE cada cinco segundos.
- `GET /dashboard/body-conditions?limit=100` — lista los padecimientos del
  usuario fijo, incluidos los resueltos.
- `PUT /dashboard/body-conditions/:muscleId` — crea o actualiza el padecimiento
  actual de una zona muscular.
- `DELETE /dashboard/body-conditions/:muscleId` — marca como resuelto el
  padecimiento activo de esa zona; conserva el registro.
- `POST /dashboard/body-conditions/:muscleId/images` — carga una imagen del
  padecimiento. Envía `multipart/form-data` con el campo `image`; se aceptan
  JPEG, PNG o WebP de hasta 10 MB. El backend genera el nombre y la ruta.
- `GET /dashboard/body-conditions/:muscleId/images` — lista las imágenes de esa
  zona con enlaces firmados válidos durante una hora.
- `DELETE /dashboard/body-conditions/:muscleId/images/:fileName` — elimina una
  imagen cargada para esa zona.
- `GET /dashboard/health-checks?limit=100` — lista los cuestionarios diarios
  del usuario fijo.
- `PUT /dashboard/health-checks/:dateIso` — crea o actualiza el cuestionario
  de esa fecha (`YYYY-MM-DD`).
- `GET /dashboard/weights?limit=100` — pesajes del usuario activo, del más
  reciente al más antiguo. Cada uno trae `metrics` (o `null` si todavía no hay
  perfil): `exact` (IMC, rangos de peso, peso ideal; cuentas directas) y
  `estimated` (grasa %, masa grasa y magra, agua, metabolismo basal; fórmulas de
  población, **no** mediciones: la báscula solo entrega el peso). Con el perfil
  incompleto no se suponen datos: sin sexo `idealWeightKg` y `weightToIdealKg`
  son `null`, y sin edad o sexo `estimated` es `null`.
- `GET /dashboard/body-profile` — estatura, edad y sexo del usuario activo
  (404 si no existe).
- `PUT /dashboard/body-profile` `{ "heightCm": 177, "ageYears"?: 25, "sex"?: "male" | "female" }`
  — crea o reemplaza ese perfil; solo la estatura es obligatoria y lo que no se
  envíe queda en `null`. Las métricas de `/dashboard/weights` se recalculan con
  él, también para pesajes anteriores. Para cargarlo sin armar la petición:
  `npm run body-profile -- --height 177 [--age 25] [--sex male]` (usa
  `DASHBOARD_API_TOKEN` del `.env` y `BACKEND_URL`, por defecto
  `http://localhost:3000`).
- `GET /dashboard/data?limit=500` — datos para el frontend independiente,
  protegidos con la contraseña web.

`/dashboard/samples`, `/dashboard/samples/stream` y todas las rutas
`/dashboard/body-conditions`, `/dashboard/health-checks`, `/dashboard/weights` y
`/dashboard/body-profile` requieren
`Authorization: Bearer <DASHBOARD_API_TOKEN>`. No requieren inicio de sesión.
`/dashboard/data` usa la contraseña web independiente. Cada consulta de datos
del usuario filtra explícitamente por `DASHBOARD_USER_ID`; la clave
service-role omite RLS, por lo que este filtro del backend es esencial.

La tabla `body_conditions` conserva un estado por usuario y músculo: el ID
estable de la zona 3D, la sección anatómica y el nombre visible, padecimiento,
descripción, intensidad del dolor (1–10), hinchazón y limitación funcional.
`recorded_at` indica el último registro; `created_at` y `updated_at` conservan
la cronología del estado. Al limpiar una observación se marca como resuelta en
vez de borrar la fila. Los nombres anatómicos se guardan como instantáneas para
que los registros sigan siendo legibles aunque cambie el catálogo del modelo.

Las imágenes se guardan en el bucket configurado en `SUPABASE_STORAGE_BUCKET`,
bajo una ruta generada por el backend con el UUID del usuario y el ID del
músculo. El bucket puede permanecer privado: la API usa la clave de servidor
para Storage y devuelve enlaces firmados temporales. Las rutas de imágenes
comparten `DASHBOARD_API_TOKEN` con las demás rutas de padecimientos; nunca
envíes `SUPABASE_SERVICE_ROLE_KEY` al frontend.

La tabla `daily_health_checks` guarda una fila por usuario y fecha: glucosa,
presión sistólica y diastólica, temperatura, horas de sueño, ánimo, síntomas,
notas, estado general y recomendación. Las mediciones son opcionales;
`recorded_at` y `updated_at` los genera el servidor y se actualizan al editar
el cuestionario del mismo día.

El token de API está pensado para llamadas servidor-a-servidor. No lo incluyas
en JavaScript que se entrega al navegador ni en una app móvil: sus usuarios
podrían extraerlo. El frontend utiliza únicamente la contraseña web separada.
