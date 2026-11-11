# Prueba aislada de App Service

Esta miniaplicación independiente prueba si Zepp OS mantiene un servicio activo después de salir de su interfaz en Amazfit Active 2. Tiene otro `appId` que la miniaplicación WachiMoles principal y no modifica ni carga datos en su backend.

El servicio registra eventos de `HeartRate.onCurrentChange`, `Stress.onChange` y un latido por minuto mediante `Time.onPerMinute`. Los valores solo aparecen en el registro de depuración de Zepp; no se guardan ni se transmiten.

## Compilar e instalar

Desde esta carpeta, compila para la variante de tu reloj:

```powershell
zeus build --target "Amazfit Active 2 (Round)"
```

Después inicia la vista previa:

```powershell
zeus preview --target "Amazfit Active 2 (Round)"
```

Para el modelo cuadrado:

```powershell
zeus build --target "Amazfit Active 2 (Square)"
zeus preview --target "Amazfit Active 2 (Square)"
```

Instala/abre **WachiMoles Background Test** en el reloj. Esta prueba exige API_LEVEL 3.0 o posterior; la lista de dispositivos Zepp OS indica API_LEVEL 4.2 para Active 2 Round y Square.

## Probar ejecución en segundo plano

1. Recompila y vuelve a instalar la versión actualizada. Abre la miniaplicación de prueba y concede los permisos de información del dispositivo, servicio en segundo plano, frecuencia cardíaca y estrés cuando los solicite.
2. Pulsa **Iniciar servicio** y espera a que indique que está activo.
3. Sal de la miniaplicación o apaga la pantalla. Déjala en segundo plano durante al menos dos minutos.
4. Vuelve a abrir la miniaplicación y pulsa **Actualizar estado**. El servicio debería seguir activo; revisa el registro de Zepp para los mensajes de frecuencia cardíaca y `Background service heartbeat`.
5. Pulsa **Detener servicio** y confirma que se detiene.

La prueba no puede confirmar por sí sola el comportamiento de cada firmware ni garantiza ejecución indefinida. Detén el servicio al terminar; los sensores activos consumen batería. Si no aparecen eventos, registra si el servicio sigue activo y los errores mostrados por Zeus/Zepp para aislar si el límite está en el servicio o en la API del sensor.

## Configuración

El servicio se declara en `targets.default.module.app-service.services` de `app.json`. Para iniciar o detenerlo se usa `@zos/app-service`; el permiso dinámico se consulta y solicita con `@zos/app`. El servicio implementa el ciclo de vida global `AppService`.

Referencias oficiales:

- [AppService](https://docs.zepp.com/docs/reference/device-app-api/newAPI/global/AppService/)
- [app-service start](https://docs.zepp.com/docs/reference/device-app-api/newAPI/app-service/start/)
- [app-service stop](https://docs.zepp.com/docs/reference/device-app-api/newAPI/app-service/stop/)
- [Mini Program Configuration](https://docs.zepp.com/docs/reference/app-json/)
