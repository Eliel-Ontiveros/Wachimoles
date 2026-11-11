import { queryPermission, requestPermission } from "@zos/app";
import * as appService from "@zos/app-service";
import { getDeviceInfo } from "@zos/device";
import { align, createWidget, prop, widget } from "@zos/ui";
import { log, px } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base/base-page";
import {
  BgService,
  pagePlugin as backgroundServicePagePlugin
} from "@zeppos/zml/3.0/module/app-service/plugin/page";

const SERVICE_FILE = "app-service/health_monitor";
const REQUIRED_PERMISSIONS = [
  "device:os.bg_service",
  "data:os.device.info",
  "data:user.hd.heart_rate",
  "data:user.hd.stress",
  "data:user.hd.step",
  "data:user.hd.spo2"
];
const logger = log.getLogger("health-test.page");
const { width: SCREEN_WIDTH } = getDeviceInfo();
const CONTENT_WIDTH = Math.min(px(360), SCREEN_WIDTH - px(40));
const LEFT = (SCREEN_WIDTH - CONTENT_WIDTH) / 2;

BasePage.use(backgroundServicePagePlugin);

function createText(text, y, height, size, options = {}) {
  return createWidget(widget.TEXT, {
    x: options.x === undefined ? LEFT : options.x,
    y: px(y),
    w: options.width === undefined ? CONTENT_WIDTH : options.width,
    h: px(height),
    text,
    text_size: px(size),
    color: options.color === undefined ? 0xffffff : options.color,
    align_h: options.align === undefined ? align.CENTER_H : options.align,
    align_v: align.CENTER_V
  });
}

function createPanel(y, height, accentColor) {
  createWidget(widget.FILL_RECT, {
    x: LEFT,
    y: px(y),
    w: CONTENT_WIDTH,
    h: px(height),
    color: 0x182338,
    radius: px(16)
  });
  createWidget(widget.FILL_RECT, {
    x: LEFT,
    y: px(y + 12),
    w: px(4),
    h: px(height - 24),
    color: accentColor
  });
}

function serviceIsRunning() {
  const runningServices = appService.getAllAppServices();
  logger.log(`Running App Services: ${JSON.stringify(runningServices)}`);
  const normalizeServiceFile = (file) =>
    file.replace(/^\/+/, "").replace(/\.js$/, "");

  return runningServices.some(
    (file) => normalizeServiceFile(file) === normalizeServiceFile(SERVICE_FILE)
  );
}

Page(
  BasePage({
    state: {
      statusWidget: null,
      statusIndicatorWidget: null,
      heartRateWidget: null,
      stressWidget: null,
      startButton: null,
      stopButton: null,
      backgroundService: null,
      busy: false
    },
    build() {
      createWidget(widget.CIRCLE, {
        x: (SCREEN_WIDTH - px(12)) / 2,
        y: px(38),
        w: px(12),
        h: px(12),
        color: 0x31d0c6
      });
      createText("WACHIMOLES", 55, 26, 16, { color: 0x31d0c6 });
      createText("Monitoreo de salud", 84, 34, 22);

      createWidget(widget.FILL_RECT, {
        x: LEFT,
        y: px(119),
        w: CONTENT_WIDTH,
        h: px(72),
        color: 0x182338,
        radius: px(16)
      });
      createText(
        "RITMO CARDÍACO",
        126,
        23,
        13,
        {
          x: LEFT + px(22),
          width: CONTENT_WIDTH - px(34),
          align: align.LEFT,
          color: 0xaab7cc
        }
      );
      this.state.heartRateWidget = createText("-- bpm", 148, 34, 27, {
        x: LEFT + px(22),
        width: CONTENT_WIDTH - px(34),
        align: align.LEFT
      });

      createPanel(201, 72, 0x31d0c6);
      createText("NIVEL DE ESTRÉS", 208, 23, 13, {
        x: LEFT + px(22),
        width: CONTENT_WIDTH - px(34),
        align: align.LEFT,
        color: 0xaab7cc
      });
      this.state.stressWidget = createText("--", 230, 34, 27, {
        x: LEFT + px(22),
        width: CONTENT_WIDTH - px(34),
        align: align.LEFT
      });

      this.state.statusIndicatorWidget = createWidget(widget.CIRCLE, {
        x: LEFT + px(12),
        y: px(287),
        w: px(8),
        h: px(8),
        color: 0x77849a
      });
      this.state.statusWidget = createText(
        "Listo para iniciar el monitoreo",
        276,
        30,
        13,
        {
          x: LEFT + px(27),
          width: CONTENT_WIDTH - px(35),
          align: align.LEFT,
          color: 0xaab7cc
        }
      );

      this.state.startButton = this.createControlButton(
        "Iniciar en segundo plano",
        310,
        () => this.startMonitoring(),
        0x087f8c,
        0x07545c
      );
      this.state.stopButton = this.createControlButton(
        "Detener monitoreo",
        368,
        () => this.stopMonitoring(),
        0x753548,
        0x4c2634
      );

      this.state.backgroundService = BgService.instance(SERVICE_FILE);
      this.state.backgroundService.onMessage = (message) =>
        this.handleServiceMessage(message);
      this.refreshStatus();
    },
    createControlButton(text, y, onClick, color, pressedColor) {
      return createWidget(widget.BUTTON, {
        x: LEFT,
        y: px(y),
        w: CONTENT_WIDTH,
        h: px(50),
        text,
        text_size: px(18),
        radius: px(12),
        normal_color: color,
        press_color: pressedColor,
        click_func: onClick
      });
    },
    setStatus(message, active = false) {
      if (this.state.statusWidget) {
        this.state.statusWidget.setProperty(prop.TEXT, message);
      }
      if (this.state.statusIndicatorWidget) {
        this.state.statusIndicatorWidget.setProperty(
          prop.COLOR,
          active ? 0x31d0c6 : 0x77849a
        );
      }
      if (this.state.startButton) {
        this.state.startButton.setProperty(
          prop.TEXT,
          active ? "Monitoreo activo" : "Iniciar en segundo plano"
        );
      }
    },
    handleServiceMessage(message) {
      if (!message || typeof message !== "object") {
        logger.error("Received an invalid background-service message");
        return;
      }

      if (message.type === "SAMPLE") {
        const sample = message.sample;
        if (
          !sample ||
          typeof sample.value !== "number" ||
          !Number.isFinite(sample.value)
        ) {
          logger.error("Received an invalid sample from background service");
          return;
        }

        if (sample.metric === "heart_rate" && sample.value > 0) {
          this.state.heartRateWidget.setProperty(
            prop.TEXT,
            `${sample.value} bpm`
          );
        } else if (sample.metric === "stress" && sample.value >= 0) {
          this.state.stressWidget.setProperty(prop.TEXT, `${sample.value}`);
        }
        return;
      }

      if (
        message.type === "SAMPLE_UNAVAILABLE" &&
        message.metric === "heart_rate"
      ) {
        this.state.heartRateWidget.setProperty(prop.TEXT, "-- bpm");
        return;
      }

      if (message.type === "STATUS") {
        this.setStatus(
          message.warning ||
            (message.active
              ? "Servicio activo; continúa al salir de la app."
              : "Monitoreo detenido"),
          message.active === true
        );
      }
    },
    refreshStatus() {
      try {
        const [backgroundPermission] = queryPermission({
          permissions: ["device:os.bg_service"]
        });
        if (backgroundPermission !== 2) {
          this.setStatus("Listo para iniciar el monitoreo");
          return;
        }

        const active = serviceIsRunning();
        this.setStatus(
          active
            ? "Servicio activo; continúa al salir de la app."
            : "Servicio detenido; inicia el monitoreo para continuar.",
          active
        );
        if (active && this.state.backgroundService) {
          this.state.backgroundService.postMessage({ type: "GET_LATEST" });
        }
      } catch (error) {
        logger.error("Could not query background service status:", error);
        this.setStatus("No se pudo consultar el estado del servicio");
      }
    },
    startMonitoring() {
      if (this.state.busy) {
        return;
      }

      let permissions;
      try {
        permissions = queryPermission({
          permissions: REQUIRED_PERMISSIONS
        });
      } catch (error) {
        logger.error("Could not query monitoring permissions:", error);
        this.setStatus("No se pudieron consultar los permisos");
        return;
      }

      if (
        permissions.length === REQUIRED_PERMISSIONS.length &&
        permissions.every((permission) => permission === 2)
      ) {
        this.startService();
        return;
      }

      if (permissions.some((permission) => permission === 1)) {
        this.setStatus("Uno o más permisos no están disponibles");
        return;
      }

      try {
        requestPermission({
          permissions: REQUIRED_PERMISSIONS,
          callback: (results) => {
            if (
              Array.isArray(results) &&
              results.length === REQUIRED_PERMISSIONS.length &&
              results.every((permission) => permission === 2)
            ) {
              this.startService();
            } else {
              this.setStatus("Falta uno o más permisos requeridos");
            }
          }
        });
      } catch (error) {
        logger.error("Could not request monitoring permissions:", error);
        this.setStatus("No se pudieron solicitar los permisos");
      }
    },
    startService() {
      try {
        if (serviceIsRunning()) {
          this.setStatus(
            "Servicio activo; continúa al salir de la app.",
            true
          );
          return;
        }
      } catch (error) {
        logger.error("Could not check whether service is already running:", error);
        this.setStatus("No se pudo consultar el estado del servicio");
        return;
      }

      this.state.busy = true;
      this.setStatus("Iniciando servicio...");
      try {
        const result = appService.start({
          file: SERVICE_FILE,
          param: "source=main-app",
          reload: true,
          complete_func: (info) => {
            this.state.busy = false;
            if (info && info.result === true) {
              this.setStatus(
                "Servicio activo; continúa al salir de la app.",
                true
              );
              logger.log("Background health service started");
              return;
            }

            logger.error("Background service start failed:", info);
            this.setStatus("No se pudo iniciar el servicio");
          }
        });

        if (result !== 0) {
          this.state.busy = false;
          logger.error(`Background service start returned code ${result}`);
          this.setStatus(`Error al iniciar el servicio (${result})`);
        }
      } catch (error) {
        this.state.busy = false;
        logger.error("Could not start background service:", error);
        this.setStatus("Error al iniciar el servicio");
      }
    },
    stopMonitoring() {
      if (this.state.busy) {
        return;
      }

      let running;
      try {
        running = serviceIsRunning();
      } catch (error) {
        logger.error("Could not query background service status:", error);
        this.setStatus("No se pudo consultar el estado del servicio");
        return;
      }

      if (!running) {
        this.setStatus("El monitoreo no está activo");
        return;
      }

      this.state.busy = true;
      this.setStatus("Deteniendo servicio...");
      try {
        const result = appService.stop({
          file: SERVICE_FILE,
          complete_func: (info) => {
            this.state.busy = false;
            if (info && info.result === true) {
              this.setStatus("Monitoreo y sensores detenidos");
              logger.log("Background health service stopped");
              return;
            }

            logger.error("Background service stop failed:", info);
            this.setStatus("No se pudo detener el servicio");
          }
        });

        if (result !== 0) {
          this.state.busy = false;
          logger.error(`Background service stop returned code ${result}`);
          this.setStatus(`Error al detener el servicio (${result})`);
        }
      } catch (error) {
        this.state.busy = false;
        logger.error("Could not stop background service:", error);
        this.setStatus("Error al detener el servicio");
      }
    },
    onResume() {
      this.refreshStatus();
    },
    onDestroy() {
      if (this.state.backgroundService) {
        this.state.backgroundService.onMessage = null;
      }
    }
  })
);
