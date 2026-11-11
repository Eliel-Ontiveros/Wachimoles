import { queryPermission, requestPermission } from "@zos/app";
import * as appService from "@zos/app-service";
import { align, createWidget, prop, widget } from "@zos/ui";
import { getDeviceInfo } from "@zos/device";
import { log, px } from "@zos/utils";

const SERVICE_FILE = "app-service/health_monitor";
const REQUIRED_PERMISSIONS = [
  "device:os.bg_service",
  "data:os.device.info",
  "data:user.hd.heart_rate",
  "data:user.hd.stress"
];
const logger = log.getLogger("wachimoles.bg-test.page");
const { width: SCREEN_WIDTH } = getDeviceInfo();
const CONTENT_WIDTH = Math.min(px(340), SCREEN_WIDTH - px(36));
const LEFT = (SCREEN_WIDTH - CONTENT_WIDTH) / 2;

function createText(text, y, height, size, color = 0xffffff) {
  return createWidget(widget.TEXT, {
    x: LEFT,
    y: px(y),
    w: CONTENT_WIDTH,
    h: px(height),
    text,
    text_size: px(size),
    color,
    align_h: align.CENTER_H,
    align_v: align.CENTER_V
  });
}

function serviceIsRunning() {
  return appService.getAllAppServices().includes(SERVICE_FILE);
}

Page({
  state: {
    statusWidget: null,
    serviceButton: null,
    busy: false
  },
  build() {
    createText("WACHIMOLES", 58, 28, 17, 0x31d0c6);
    createText("Prueba de App Service", 92, 34, 21);
    createText(
      "Activa los sensores y luego sal de esta app.\nEl servicio no envía datos al backend.",
      140,
      64,
      14,
      0xaab7cc
    );

    this.state.statusWidget = createText(
      serviceIsRunning()
        ? "Servicio activo"
        : "Servicio detenido",
      224,
      40,
      16,
      0xffd166
    );

    this.state.serviceButton = createWidget(widget.BUTTON, {
      x: LEFT,
      y: px(286),
      w: CONTENT_WIDTH,
      h: px(54),
      text: serviceIsRunning() ? "Detener servicio" : "Iniciar servicio",
      text_size: px(18),
      radius: px(12),
      normal_color: 0x087f8c,
      press_color: 0x07545c,
      click_func: () => this.toggleService()
    });

    createWidget(widget.BUTTON, {
      x: LEFT,
      y: px(350),
      w: CONTENT_WIDTH,
      h: px(48),
      text: "Actualizar estado",
      text_size: px(16),
      radius: px(12),
      normal_color: 0x35445c,
      press_color: 0x263244,
      click_func: () => this.refreshStatus()
    });
  },
  setStatus(text) {
    this.state.statusWidget.setProperty(prop.TEXT, text);
  },
  refreshStatus() {
    try {
      const running = serviceIsRunning();
      this.state.serviceButton.setProperty(
        prop.TEXT,
        running ? "Detener servicio" : "Iniciar servicio"
      );
      this.setStatus(running ? "Servicio activo" : "Servicio detenido");
    } catch (error) {
      logger.error("Could not query background service status:", error);
      this.setStatus("No se pudo consultar el servicio");
    }
  },
  toggleService() {
    if (this.state.busy) {
      return;
    }

    let running;
    try {
      running = serviceIsRunning();
    } catch (error) {
      logger.error("Could not query background service status:", error);
      this.setStatus("No se pudo consultar el servicio");
      return;
    }

    if (running) {
      this.stopService();
      return;
    }

    this.requestBackgroundPermission();
  },
  requestBackgroundPermission() {
    let permissionResults;
    try {
      permissionResults = queryPermission({
        permissions: REQUIRED_PERMISSIONS
      });
    } catch (error) {
      logger.error("Could not query background-service permission:", error);
      this.setStatus("No se pudo consultar el permiso");
      return;
    }

    if (permissionResults.every((result) => result === 2)) {
      this.startService();
      return;
    }

    if (permissionResults.some((result) => result === 1)) {
      this.setStatus("Permiso de servicio no disponible");
      return;
    }

    try {
      requestPermission({
        permissions: REQUIRED_PERMISSIONS,
        callback: (results) => {
          if (
            results.length === REQUIRED_PERMISSIONS.length &&
            results.every((result) => result === 2)
          ) {
            this.startService();
          } else {
            this.setStatus("Falta uno o más permisos requeridos");
          }
        }
      });
    } catch (error) {
      logger.error("Could not request background-service permission:", error);
      this.setStatus("No se pudo solicitar el permiso");
    }
  },
  startService() {
    this.state.busy = true;
    this.setStatus("Iniciando servicio...");

    try {
      const result = appService.start({
        url: SERVICE_FILE,
        param: "source=background-test",
        complete_func: (info) => {
          this.state.busy = false;
          if (info && info.result === true) {
            this.setStatus("Servicio activo; ya puedes salir");
            this.state.serviceButton.setProperty(prop.TEXT, "Detener servicio");
            logger.log("Background service started successfully");
            return;
          }

          logger.error("Background service start failed:", info);
          this.setStatus("No se pudo iniciar el servicio");
          this.refreshStatus();
        }
      });

      if (result !== 0) {
        this.state.busy = false;
        logger.error(`Background service start returned code ${result}`);
        this.setStatus(`Error al iniciar servicio (${result})`);
      }
    } catch (error) {
      this.state.busy = false;
      logger.error("Could not start background service:", error);
      this.setStatus("Error al iniciar el servicio");
    }
  },
  stopService() {
    this.state.busy = true;
    this.setStatus("Deteniendo servicio...");

    try {
      const result = appService.stop({
        url: SERVICE_FILE,
        complete_func: (info) => {
          this.state.busy = false;
          if (info && info.result === true) {
            this.setStatus("Servicio detenido");
            this.state.serviceButton.setProperty(prop.TEXT, "Iniciar servicio");
            logger.log("Background service stopped successfully");
            return;
          }

          logger.error("Background service stop failed:", info);
          this.setStatus("No se pudo detener el servicio");
          this.refreshStatus();
        }
      });

      if (result !== 0) {
        this.state.busy = false;
        logger.error(`Background service stop returned code ${result}`);
        this.setStatus(`Error al detener servicio (${result})`);
      }
    } catch (error) {
      this.state.busy = false;
      logger.error("Could not stop background service:", error);
      this.setStatus("Error al detener el servicio");
    }
  }
});
