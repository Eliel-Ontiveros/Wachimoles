# Prueba de lectura y envío de métricas fisiológicas

Miniaplicación Zepp OS para obtener ritmo cardíaco y estrés en un Amazfit Active 2:

1. El reloj obtiene ritmo cardíaco en vivo con `HeartRate.onCurrentChange`.
2. La app escucha actualizaciones de estrés con `Stress.onChange`; no solicita históricos.
3. Cada minuto, la miniaplicación envía las últimas lecturas por BLE al Side Service de Zepp App.
4. El Side Service realiza un `POST` a la API de Vercel.
5. La API valida y guarda las muestras en una tabla de Supabase para análisis histórico.

La pantalla presenta los valores en paneles diferenciados y solo ofrece **Iniciar monitoreo** y **Detener monitoreo**. Al iniciar, se activan los listeners de ritmo cardíaco y estrés y cada minuto se envían las últimas lecturas disponibles por BLE al Side Service de Zepp App, que las reenvía por HTTP al backend. Durante la sesión se prolonga el tiempo de pantalla encendida; al detenerla se restaura el ajuste normal y se apagan ambos sensores. Los iconos de las variantes redonda y cuadrada usan un motivo de pulso y exploración espacial.

## Alcance actual

- **Ritmo cardíaco en vivo:** incluido.
- **Medición continua de prueba:** el modo reutiliza el mismo ciclo de vida de sensores que el modo manual (`onCurrentChange` para ritmo cardíaco y `onChange` para estrés). Los sensores permanecen activos durante la prueba y se detienen al pulsar **Detener monitoreo**. Esto evita reiniciar el sensor cardíaco cada minuto, pero consume más batería que una medición puntual.
- **Pantalla durante la prueba:** `setPageBrightTime` mantiene la pantalla encendida mientras la medición continua está activa. El valor se renueva en cada ciclo; al detener la medición se restaura el tiempo predeterminado. Pantalla encendida y sensores activos aceleran el consumo de batería.
- **Estrés actual:** al iniciar la escucha, la app lee inmediatamente `Stress.getCurrent()` y registra el listener `Stress.onChange` para cambios posteriores. La API no inicia una medición manual; si no hay valor actual, la pantalla informa que espera una actualización.
- **Estrés en el modo continuo:** se conserva el listener `Stress.onChange`, y además se consulta `Stress.getCurrent()` al enviar cada ciclo. La API no ofrece una operación para iniciar una medición de estrés, por lo que un valor disponible podría no ser una medición nueva de ese minuto.
- **Unidad del estrés:** la documentación describe un valor numérico, pero no especifica unidad o rango para `getCurrent()`. El backend lo guarda como `score` sin imponer un máximo.
- **SpO₂:** desactivado temporalmente. Al probar esa medición, el Amazfit Active 2 se reinició, incluso sin iniciar primero ritmo cardíaco. La miniapp ya no llama a la API de SpO₂ ni solicita su permiso.
- **Ritmo cardíaco durante el sueño, duración del sueño, fases y otras métricas del sueño:** omitidos por ahora. Las APIs Zepp `HeartRate.getToday()` y `Sleep.getInfo()`/`getStage()` consultan datos registrados por el sistema; esta versión no los lee.

## Base de datos Supabase y API en Vercel

La API serverless vive en `api/` y Supabase conserva una fila por muestra. El identificador `sample_id` es único para que los reintentos de Zepp no creen duplicados. `measured_at` registra cuándo midió el reloj y `received_at` cuándo se guardó en la base.

### 1. Crear la tabla

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql).
3. La tabla activa Row Level Security sin políticas públicas. La API accede desde el servidor con `SUPABASE_SERVICE_ROLE_KEY`; no copies esa clave a la miniaplicación ni a `app-side/config.js`.

### 2. Desplegar la API en Vercel

Desde la raíz del proyecto, inicia sesión y vincula/crea el proyecto de Vercel:

```powershell
npx vercel
```

En **Project Settings → Environment Variables**, agrega para Production (y Preview si se usará):

- `SUPABASE_URL`: URL del proyecto Supabase, por ejemplo `https://<project-ref>.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` del proyecto. Trátala como contraseña; solo debe existir como variable de entorno de Vercel.

Despliega después de guardar las variables:

```powershell
npx vercel --prod
```

La API queda disponible en `https://<dominio-vercel>/api/samples`; la comprobación de salud es `https://<dominio-vercel>/api/health`. La función no necesita un servidor Node ejecutándose en tu computadora. No se debe configurar CORS para que el Side Service realice su petición servidor-a-servidor.

### 3. Conectar la miniaplicación

Cuando Vercel asigne el dominio definitivo, actualiza `SAMPLE_API_URL` en [`app-side/config.js`](./app-side/config.js):

```js
export const SAMPLE_API_URL =
  "https://<dominio-vercel>/api/samples";
```

Luego recompila e instala la miniaplicación: el Side Service va incluido en el paquete del reloj y la URL queda incorporada durante la compilación. No cambies la URL a una IP local para el despliegue en la nube.

### 4. Consultas analíticas iniciales

Ejemplos para ejecutar en el SQL Editor de Supabase:

```sql
-- Resumen por día y métrica
select
  date_trunc('day', measured_at) as day,
  metric,
  count(*) as samples,
  round(avg(value)::numeric, 2) as average,
  min(value) as minimum,
  max(value) as maximum
from public.samples
group by 1, 2
order by 1 desc, 2;

-- Muestras cardíacas y de estrés recientes
select metric, value, unit, measured_at, received_at
from public.samples
where measured_at >= now() - interval '24 hours'
order by measured_at desc;
```

El archivo de prueba local `server/data/samples.jsonl` no se importa automáticamente a Supabase; los registros históricos previos requieren una importación aparte si quieren conservarlos en las analíticas.

### Seguridad y límites

La `service_role` solo se usa dentro de Vercel y nunca debe entregarse al reloj. La API valida métricas y valores, pero el endpoint de ingestión aún no autentica cada dispositivo; para producción pública conviene añadir controles contra abuso (por ejemplo, límites de tasa y una estrategia de identidad por instalación) antes de almacenar datos reales de salud. Las lecturas del wearable no son diagnósticos médicos.

## Requisitos

- Node.js 18 o posterior.
- Zepp OS Dev Tools / Zeus.
- Amazfit Active 2 emparejado con Zepp App.
- Reloj, teléfono y computadora en la misma red local para la prueba HTTP.

## Prueba local opcional

Desde la raíz del proyecto:

```powershell
npm install
npm test
npm run server
```

`npm run server` mantiene el backend JSON Lines local para desarrollo y pruebas; no es necesario para el despliegue en Vercel. Si editas `server/server.js`, detén el proceso anterior con `Ctrl+C` en la terminal donde corre y vuelve a ejecutar `npm run server`; Node no recarga el código automáticamente.

El servidor escucha en el puerto `3000` en todas las interfaces. Usa la IP de la interfaz que comparte red directamente con el teléfono, no una IP de VirtualBox, WSL o VPN. En la configuración actual del equipo, `Ethernet 4` tiene la IP `10.221.170.109`; la IP `192.168.56.1` pertenece al adaptador Host-Only de VirtualBox y no es accesible desde el teléfono. Esta IP puede cambiar, así que verifica la dirección actual antes de probar.

Para usar el backend local, edita `app-side/config.js` y configura la IP vigente de la interfaz apropiada. Por ejemplo:

```js
export const SAMPLE_API_URL = "http://10.221.170.109:3000/samples";
```

Verifica primero en la computadora que `http://10.221.170.109:3000/health` responde `{"ok":true}` y después prueba esa misma URL desde el teléfono. En la configuración actual, Windows clasifica la interfaz como red pública y el firewall podría bloquear conexiones entrantes. Si pasa eso, permite TCP 3000 solo desde la IP del teléfono mediante una regla de entrada restringida; no abras el puerto para cualquier origen ni expongas el servidor a Internet. Para saber la IP actual del teléfono en el enlace USB, consulta `Get-NetIPConfiguration` y la puerta de enlace de la interfaz que comparte la red. Después de cambiar la URL, vuelve a compilar e instalar la miniaplicación.

## Compilar y probar en el reloj

1. Inicia sesión con `zeus login` y confirma el estado con `zeus status`.
2. Compila el modelo correspondiente:

   ```powershell
   zeus build --target "Amazfit Active 2 (Round)"
   ```

   Para el modelo cuadrado, usa `Amazfit Active 2 (Square)`. La salida queda en `dist`.
3. Con el reloj emparejado y el modo de desarrollador de Zepp App configurado, usa:

   ```powershell
   zeus preview --target "Amazfit Active 2 (Round)"
   ```

   Cambia el target por `Amazfit Active 2 (Square)` si corresponde.
4. Abre **WachiMoles Health Test** y concede los permisos de frecuencia cardíaca y estrés.
5. Pulsa **Iniciar monitoreo**. La app mantiene la pantalla encendida y el primer envío ocurre al minuto; los siguientes se programan cada 60 segundos.
6. Confirma los envíos en el reloj y revisa la tabla `public.samples` en Supabase (o `server/data/samples.jsonl` cuando uses el backend local).
7. Pulsa **Detener monitoreo** para cancelar los envíos, detener ambos sensores y restaurar el tiempo de pantalla predeterminado.

La miniaplicación no ofrece ejecución persistente en segundo plano. La API de pantalla documenta que el sistema termina la miniaplicación después de apagar la pantalla y solo permite relanzarla al volver a encender el reloj; por eso esta prueba mantiene la pantalla encendida. No cierres la miniaplicación durante la medición: salir puede destruir la página y detener los sensores.

El modo puntual que inicia y detiene el sensor cardíaco automáticamente se descartó después de que el reloj se reiniciara en una prueba. La causa no está identificada; esta versión evita esos arranques y paradas repetidos y usa el mismo listener estable del modo manual.

La app requiere los permisos `data:os.device.info`, `data:user.hd.heart_rate` y `data:user.hd.stress`. `HeartRate.onCurrentChange` requiere API_LEVEL 2.1 o superior; la API `Stress` está disponible desde API_LEVEL 2.0. Después de compilar e instalar la nueva versión, concede los permisos solicitados en Zepp App.

No vuelvas a probar SpO₂ con este dispositivo por ahora. El reinicio sucedió incluso sin medir ritmo cardíaco; la causa no está identificada y podría requerir diagnóstico de Zepp o una actualización de firmware.

## Configuración Zepp

`app.json` usa el target `default` con plataformas redonda y cuadrada. La compatibilidad concreta debe confirmarse instalando en el reloj real.

## Límites

- El backend local JSON Lines solo es adecuado para pruebas; el historial productivo se guarda en Supabase.
- Las lecturas de un wearable de consumo no son mediciones médicas ni están validadas para decisiones de seguridad.
- El modo continuo requiere que la miniaplicación permanezca abierta y la pantalla encendida; no se ejecuta en segundo plano ni continúa después de que Zepp OS cierre la página.
- Esta prueba no valida continuidad prolongada, precisión clínica ni uso en una misión espacial.
