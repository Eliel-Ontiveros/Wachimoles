# Prueba de lectura y envío de métricas fisiológicas

Miniaplicación Zepp OS para registrar ritmo cardíaco, estrés, pasos y SpO₂ en un Amazfit Active 2:

1. Un App Service consulta el historial de ritmo cardíaco del sistema con `HeartRate.getToday()` y escucha cambios de estrés con `Stress.onChange`.
2. El sensor de hora (`Time.onPerMinute`) ejecuta un ciclo cada minuto, también desde el App Service.
3. Las lecturas se envían por BLE al Side Service de Zepp App usando el proxy HTTP de ZML.
4. El Side Service realiza un `POST` a la API de Vercel.
5. La API valida y guarda las muestras en Supabase para análisis histórico. Los pasos se actualizan en una sola fila por día.

Mientras la pantalla principal está abierta, la miniaplicación extiende al máximo el tiempo de iluminación de esa página y suspende el apagado por bajar la muñeca o cubrir la pantalla. Al salir de la página, restaura esos comportamientos. El tiempo de iluminación es finito según la API de Zepp OS; el sistema todavía puede apagar la pantalla por el botón físico o por políticas del dispositivo.

La pantalla permite iniciar y detener el servicio; al iniciarlo se puede salir de la miniaplicación y apagar la pantalla. El servicio mantiene los sensores y el temporizador activos. Una alarma persistente abre una página de recuperación cada minuto; la página reinicia el servicio si se detuvo y regresa a la pantalla previa. **Detener monitoreo** cancela la alarma y detiene ambos listeners.

## Alcance actual

- **Ritmo cardíaco en vivo:** incluido.
- **Medición en segundo plano:** `app-service/health_monitor` mantiene los listeners de sensores; `Time.onPerMinute` activa un ciclo de envío cada minuto desde el App Service. Una alarma persistente abre `page/watchdog` cada minuto; esa página inicia el monitor si ya no aparece entre los servicios activos. **Detener monitoreo** desactiva y cancela la alarma antes de detener el servicio. La recuperación depende de que Zepp OS permita ejecutar la alarma y el App Service.
- **Ritmo cardíaco:** el servicio consulta `HeartRate.getToday()` al iniciar y en cada ciclo por minuto. Cuando el reloj registra una medición individual, `HeartRate.onLastChange` lee directamente `HeartRate.getLast()` para no depender de que el historial por minuto ya se haya actualizado; si esa lectura no está disponible, intenta usar el historial. No activa el muestreo continuo de alta frecuencia. Las lecturas programadas solo se envían si son de los últimos cinco minutos.
- **Estrés actual:** el servicio lee `Stress.getCurrent()` al comenzar, en cada cambio y en cada ciclo de envío. La API no inicia una medición manual, por lo que un valor disponible puede no ser una medición nueva de ese minuto.
- **Pasos diarios:** el servicio consulta el total acumulado con `Step.getCurrent()` al iniciar y cada minuto. Cada día usa un `sample_id` local de formato `steps-YYYY-MM-DD`; las nuevas lecturas actualizan esa misma fila en vez de insertar otra.
- **SpO₂ histórico:** cada minuto consulta `BloodOxygen.getLastFewHour(24)` y envía las mediciones nuevas que ya registró el reloj. No llama `BloodOxygen.start()` ni inicia un análisis; al iniciar el servicio solo considera lecturas de los últimos 10 minutos y luego procesa las nuevas en orden.
- **Sueño diario:** lee `Sleep.getInfo()` al iniciar y cada 30 minutos. Envía `totalTime` convertido de minutos a horas y actualiza una sola muestra `sleep-YYYY-MM-DD` correspondiente al día local de lectura. No inicia ni fuerza un análisis de sueño; depende de los datos que Zepp OS ya haya sincronizado.
- **Red:** el servicio hace las solicitudes mediante `httpRequest` de ZML; el Side Service de Zepp App actúa como proxy de red y reenvía la petición a la URL configurada en `app-side/config.js`.
- **Unidad del estrés:** la documentación describe un valor numérico, pero no especifica unidad o rango para `getCurrent()`. El backend lo guarda como `score` sin imponer un máximo.
- **Fases del sueño:** no se guardan por ahora; solo se incorpora la duración total.

## Base de datos Supabase y API en Vercel

La API serverless vive en `api/` y Supabase conserva una fila por muestra, excepto pasos, que mantienen una fila por día. El identificador `sample_id` es único para que los reintentos de Zepp no creen duplicados y las actualizaciones diarias de pasos hagan upsert. `measured_at` registra cuándo midió el reloj y `received_at` cuándo se guardó en la base.

### 1. Crear la tabla

1. Crea un proyecto en Supabase.
2. En **SQL Editor**, ejecuta el contenido de [`supabase/schema.sql`](./supabase/schema.sql).
   Si ya existe la tabla, ejecuta una vez [`supabase/migrations/20261111_add_daily_steps.sql`](./supabase/migrations/20261111_add_daily_steps.sql) para permitir los totales diarios de pasos.
   Para una tabla existente, ejecuta también la migración
   [`20261111_add_user_ownership_to_samples.sql`](../Wachimoles_Movil/supabase/migrations/20261111_add_user_ownership_to_samples.sql)
   para agregar `user_id`.
   Para habilitar la nueva métrica de sueño en una tabla existente, ejecuta
   [`20261113_add_sleep_samples.sql`](../Wachimoles_Backend/supabase/migrations/20261113_add_sleep_samples.sql).
3. La tabla activa Row Level Security sin políticas públicas. La API accede desde el servidor con `SUPABASE_SERVICE_ROLE_KEY`; no copies esa clave a la miniaplicación ni a `app-side/config.js`.

### 2. Desplegar la API en Vercel

Desde la raíz del proyecto, inicia sesión y vincula/crea el proyecto de Vercel:

```powershell
npx vercel
```

En **Project Settings → Environment Variables**, agrega para Production (y Preview si se usará):

- `SUPABASE_URL`: URL del proyecto Supabase, por ejemplo `https://<project-ref>.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY`: clave `service_role` del proyecto. Trátala como contraseña; solo debe existir como variable de entorno de Vercel.
- `DASHBOARD_USER_ID`: UUID de la cuenta Supabase que será propietaria de las nuevas muestras. Se puede consultar en **Authentication → Users**. La API lo asigna desde el servidor; no acepta un propietario indicado por el reloj.

Despliega después de guardar las variables:

```powershell
npx vercel --prod
```

La API queda disponible en `https://<dominio-vercel>/api/samples`; la comprobación de salud es `https://<dominio-vercel>/api/health`. La función no necesita un servidor Node ejecutándose en tu computadora. El Side Service del teléfono realiza las solicitudes reenviadas por BLE desde el reloj.

La API guarda `measured_at` y `received_at` como instantes UTC reales, sin aplicar desplazamientos fijos. El panel de Supabase suele mostrar `timestamptz` en UTC; para comparar con la hora local del reloj, convierte el valor a la zona horaria del dispositivo al consultarlo. Las filas guardadas por versiones anteriores tienen un desplazamiento fijo de 8 horas y no se corrigen automáticamente.

Las nuevas muestras enviadas a esta API quedan asociadas al UUID configurado en
`DASHBOARD_USER_ID`. Esto solo aplica a inserciones futuras; las muestras
existentes conservan `user_id` nulo hasta asignarlas explícitamente después de
verificar su propietario.

### 3. Conectar la miniaplicación

Cuando Vercel asigne el dominio definitivo, actualiza `SAMPLE_API_URL` en [`app-side/config.js`](./app-side/config.js):

```js
export const SAMPLE_API_URL =
  "https://<dominio-vercel>/api/samples";
```

Luego recompila e instala la miniaplicación: la URL se incorpora durante la compilación y el Side Service reenvía las peticiones del App Service. No cambies la URL a una IP local para el despliegue en la nube.

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
4. Abre **WachiMoles Health Test** y concede los permisos de información del dispositivo, servicio en segundo plano, alarmas, frecuencia cardíaca, estrés, pasos y SpO₂.
5. Pulsa **Iniciar en segundo plano**. El servicio procesa ritmo cardíaco, estrés, el historial de SpO₂ y el total de pasos cada minuto. Puedes salir de la miniaplicación y apagar la pantalla; la alarma abre brevemente la página de recuperación cada minuto.
6. Para probar una interrupción, deja activa la miniaplicación y comprueba los registros JS de Zepp; una permanencia de 20 minutos verifica que el servicio y el watchdog siguen activos, pero para comprobar un reinicio debe ocurrir una interrupción inesperada. La alarma reintentará el inicio en el siguiente minuto.
7. Revisa la tabla `public.samples` en Supabase (o `server/data/samples.jsonl` si configuraste el backend local).
8. Vuelve a abrir la miniaplicación y pulsa **Detener monitoreo** para cancelar la alarma de recuperación, el temporizador y los listeners de sensores.

El App Service se probó en un Amazfit Active 2. La integración principal usa el mismo mecanismo; verifica los registros y las muestras en Supabase después de probarla en tu reloj.

El modo puntual que inicia y detiene el sensor cardíaco automáticamente se descartó después de que el reloj se reiniciara en una prueba. La causa no está identificada; esta versión evita esos arranques y paradas repetidos y usa el mismo listener estable del modo manual.

La app está configurada con API_LEVEL mínimo 4.0 y requiere `device:os.bg_service`, `device:os.alarm`, `data:os.device.info`, `data:user.hd.heart_rate`, `data:user.hd.stress`, `data:user.hd.step` y `data:user.hd.spo2`. Después de compilar e instalar la nueva versión, concede los permisos solicitados en Zepp App. La lectura de pasos y SpO₂ debe probarse en el reloj real; los builds no comprueban disponibilidad de datos ni estabilidad del firmware.

## Configuración Zepp

`app.json` usa el target `default` con plataformas redonda y cuadrada. La compatibilidad concreta debe confirmarse instalando en el reloj real.

## Límites

- El backend local JSON Lines solo es adecuado para pruebas; el historial productivo se guarda en Supabase.
- Las lecturas de un wearable de consumo no son mediciones médicas ni están validadas para decisiones de seguridad.
- El sistema operativo o la conectividad del teléfono pueden interrumpir sensores o envíos; los errores aparecen en los registros JS. No hay una cola persistente sin conexión, así que las muestras durante una interrupción podrían perderse.
- Esta prueba no valida continuidad prolongada, precisión clínica ni uso en una misión espacial.
