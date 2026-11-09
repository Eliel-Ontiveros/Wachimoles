import { HeartRate, Stress } from "@zos/sensor";
import { getDeviceInfo } from "@zos/device";
import {
  resetPageBrightTime,
  setPageBrightTime
} from "@zos/display";
import { align, createWidget, prop, widget } from "@zos/ui";
import { log, px } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base/base-page";
import { pagePlugin } from "@zeppos/zml/2.0/module/messaging/plugin/page";

BasePage.use(pagePlugin);

const logger = log.getLogger("health-test.page");
const { width: SCREEN_WIDTH } = getDeviceInfo();
const CONTENT_WIDTH = Math.min(px(360), SCREEN_WIDTH - px(40));
const LEFT = (SCREEN_WIDTH - CONTENT_WIDTH) / 2;
const CONTINUOUS_INTERVAL_MS = 60 * 1000;
const MAX_PAGE_BRIGHT_TIME_MS = 2147483000;

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

function createButton(text, y, onClick, color, pressedColor) {
  return createWidget(widget.BUTTON, {
    x: LEFT,
    y: px(y),
    w: CONTENT_WIDTH,
    h: px(50),
    text,
    text_size: px(20),
    radius: px(12),
    normal_color: color,
    press_color: pressedColor,
    click_func: onClick
  });
}

Page(
  BasePage({
    state: {
      heartRateSensor: null,
      heartRateCallback: null,
      stressSensor: null,
      stressCallback: null,
      heartRateWidget: null,
      stressWidget: null,
      statusWidget: null,
      statusIndicatorWidget: null,
      continuousButton: null,
      continuousActive: false,
      continuousTimer: null,
      continuousRunId: 0,
      latestSamples: {
        heart_rate: null,
        stress: null
      },
      sending: false
    },
    build() {
      createWidget(widget.CIRCLE, {
        x: (SCREEN_WIDTH - px(12)) / 2,
        y: px(37),
        w: px(12),
        h: px(12),
        color: 0x31d0c6
      });
      createText("WACHIMOLES", 54, 25, 16, { color: 0x31d0c6 });
      createText("Estado fisiológico", 80, 28, 22);

      createPanel(119, 72, 0xff647c);
      createText("RITMO CARDÍACO", 126, 23, 13, {
        x: LEFT + px(22),
        width: CONTENT_WIDTH - px(34),
        align: align.LEFT,
        color: 0xaab7cc
      });
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

      this.state.continuousButton = createButton("Iniciar monitoreo", 310, () => {
        this.startContinuousMeasurement();
      }, 0x087f8c, 0x07545c);
      createButton("Detener monitoreo", 368, () => {
        this.stopContinuousMeasurement();
      }, 0x753548, 0x4c2634);
    },
    startHeartRate() {
      if (this.state.heartRateCallback) {
        this.setStatus("El ritmo cardíaco ya se está midiendo.");
        return true;
      }

      const sensor = new HeartRate();
      const callback = () => {
        let value;
        try {
          value = sensor.getCurrent();
        } catch (error) {
          logger.error("Could not read current heart rate:", error);
          this.setStatus(
            error && error.message
              ? `No se pudo leer ritmo cardíaco: ${error.message}`
              : "No se pudo leer ritmo cardíaco."
          );
          return;
        }

        if (!Number.isFinite(value) || value <= 0) {
          logger.log("Heart-rate callback returned no valid value");
          return;
        }

        const measuredAt = Date.now();
        this.state.latestSamples.heart_rate = {
          metric: "heart_rate",
          value,
          unit: "bpm",
          measuredAt
        };
        this.state.heartRateWidget.setProperty(
          prop.TEXT,
          `${value} bpm`
        );
        this.setStatus(
          this.state.continuousActive
            ? "Modo continuo activo; ritmo cardíaco actualizado."
            : "Lectura cardíaca recibida."
        );
      };

      this.state.heartRateSensor = sensor;
      this.state.heartRateCallback = callback;

      try {
        sensor.onCurrentChange(callback);
        this.setStatus("Midiendo ritmo cardíaco...");
        logger.log("Heart-rate measurement started");
      } catch (error) {
        logger.error("Could not start heart-rate measurement:", error);
        this.state.heartRateSensor = null;
        this.state.heartRateCallback = null;
        this.setStatus(
          error && error.message
            ? `Error al medir ritmo cardíaco: ${error.message}`
            : "No se pudo iniciar ritmo cardíaco."
        );
        return false;
      }
      return true;
    },
    stopHeartRate(silent = false) {
      if (!this.state.heartRateSensor || !this.state.heartRateCallback) {
        if (!silent) {
          this.setStatus("No hay medición cardíaca activa.");
        }
        return true;
      }

      try {
        this.state.heartRateSensor.offCurrentChange(
          this.state.heartRateCallback
        );
        this.state.heartRateCallback = null;
        if (!silent) {
          this.setStatus("Medición cardíaca detenida.");
        }
        logger.log("Heart-rate measurement stopped");
        return true;
      } catch (error) {
        logger.error("Could not stop heart-rate measurement:", error);
        if (!silent) {
          this.setStatus(
            error && error.message
              ? `Error al detener ritmo cardíaco: ${error.message}`
              : "No se pudo detener ritmo cardíaco."
          );
        }
        return false;
      }
    },
    startStressMonitoring() {
      if (this.state.stressCallback) {
        this.setStatus("Ya se están escuchando cambios de estrés.");
        return true;
      }

      const sensor = new Stress();
      const callback = () => {
        this.captureStressReading("change");
      };

      this.state.stressSensor = sensor;
      this.state.stressCallback = callback;

      try {
        sensor.onChange(callback);
        this.setStatus("Leyendo estrés actual y escuchando cambios...");
        logger.log("Stress change listener registered");
        this.captureStressReading("initial");
      } catch (error) {
        logger.error("Could not register stress listener:", error);
        this.state.stressSensor = null;
        this.state.stressCallback = null;
        this.setStatus(
          error && error.message
            ? `Error al escuchar estrés: ${error.message}`
            : "No se pudo iniciar la escucha de estrés."
        );
        return false;
      }
      return true;
    },
    captureStressReading(source) {
      if (!this.state.stressSensor) {
        return;
      }

      let result;
      try {
        result = this.state.stressSensor.getCurrent();
      } catch (error) {
        logger.error(`Could not read current stress (${source}):`, error);
        this.setStatus(
          error && error.message
            ? `No se pudo leer el estrés actual: ${error.message}`
            : "No se pudo leer el estrés actual."
        );
        return;
      }

      logger.log(
        `Stress ${source} reading: value=${result && result.value}, time=${result && result.time}`
      );
      if (
        !result ||
        !Number.isFinite(result.value) ||
        result.value < 0
      ) {
        logger.log(`Stress ${source} reading is unavailable`);
        this.setStatus(
          "El reloj aún no reporta estrés; esperando una actualización."
        );
        return;
      }

      const sample = {
        metric: "stress",
        value: result.value,
        unit: "score",
        measuredAt: Date.now()
      };
      if (Number.isFinite(result.time)) {
        sample.sensorTime = result.time;
      }

      this.state.latestSamples.stress = sample;
      this.state.stressWidget.setProperty(
        prop.TEXT,
        `${result.value}`
      );
      if (this.state.continuousActive) {
        this.setStatus("Modo continuo activo; valor de estrés actualizado.");
      } else {
        this.setStatus(
          source === "initial"
            ? "Valor actual de estrés recibido."
            : "Actualización de estrés recibida."
        );
      }
    },
    stopStressMonitoring(silent = false) {
      if (!this.state.stressSensor || !this.state.stressCallback) {
        if (!silent) {
          this.setStatus("No hay escucha de estrés activa.");
        }
        return true;
      }

      try {
        this.state.stressSensor.offChange(this.state.stressCallback);
        this.state.stressCallback = null;
        if (!silent) {
          this.setStatus("Escucha de estrés detenida.");
        }
        logger.log("Stress change listener removed");
        return true;
      } catch (error) {
        logger.error("Could not stop stress listener:", error);
        if (!silent) {
          this.setStatus(
            error && error.message
              ? `Error al detener escucha de estrés: ${error.message}`
              : "No se pudo detener la escucha de estrés."
          );
        }
        return false;
      }
    },
    startContinuousMeasurement() {
      if (this.state.continuousActive) {
        this.setStatus("La medición continua ya está activa.");
        return;
      }

      if (this.state.sending) {
        this.setStatus("Espera a que termine el envío actual.");
        return;
      }

      const brightTimeResult = setPageBrightTime({
        brightTime: MAX_PAGE_BRIGHT_TIME_MS
      });
      if (brightTimeResult !== 0) {
        logger.error(
          `Could not extend page screen-on time: result=${brightTimeResult}`
        );
        this.setStatus(
          "No se pudo mantener la pantalla activa; medición continua no iniciada."
        );
        return;
      }

      this.state.continuousActive = true;
      this.state.continuousButton.setProperty(prop.TEXT, "Monitoreo activo");
      this.state.continuousRunId += 1;
      this.state.latestSamples.heart_rate = null;
      this.state.latestSamples.stress = null;
      const runId = this.state.continuousRunId;
      const heartRateStarted = this.startHeartRate();
      const stressMonitoringStarted = heartRateStarted
        ? this.startStressMonitoring()
        : false;

      if (!heartRateStarted || !stressMonitoringStarted) {
        this.state.continuousActive = false;
        this.state.continuousButton.setProperty(prop.TEXT, "Iniciar monitoreo");
        resetPageBrightTime();
        const heartRateStopped = this.stopHeartRate(true);
        const stressStopped = this.stopStressMonitoring(true);
        this.setStatus(
          heartRateStopped && stressStopped
            ? "No se pudo iniciar el modo continuo; se detuvieron los sensores."
            : "Error al iniciar y no se pudieron detener ambos sensores; revisa el reloj."
        );
        return;
      }

      this.state.continuousTimer = setInterval(() => {
        const brightTimeResult = setPageBrightTime({
          brightTime: MAX_PAGE_BRIGHT_TIME_MS
        });
        if (brightTimeResult !== 0) {
          logger.error(
            `Could not extend page screen-on time: result=${brightTimeResult}`
          );
          this.stopContinuousMeasurement();
          this.setStatus(
            "La pantalla ya no puede mantenerse activa; medición detenida."
          );
          return;
        }
        this.runContinuousCycle(runId);
      }, CONTINUOUS_INTERVAL_MS);
      logger.log(
        "Continuous measurement started using manual sensor listeners and a 60-second upload interval"
      );
      this.setStatus(
        "Ritmo cardíaco y estrés activos; primer envío en un minuto."
      );
    },
    runContinuousCycle(runId) {
      if (
        !this.state.continuousActive ||
        runId !== this.state.continuousRunId
      ) {
        return;
      }

      if (this.state.sending) {
        logger.log("Continuous measurement cycle skipped; previous work is active");
        return;
      }

      this.captureStressReading("continuous");
      const heartRateSample = this.state.latestSamples.heart_rate;
      const stressSample = this.state.latestSamples.stress;
      if (!heartRateSample || !stressSample) {
        this.setStatus(
          "Aún falta una lectura de ritmo cardíaco o estrés; se reintentará en un minuto."
        );
        return;
      }

      if (Date.now() - heartRateSample.measuredAt > CONTINUOUS_INTERVAL_MS) {
        this.setStatus(
          "El ritmo cardíaco no se ha actualizado en el último minuto; se reintentará."
        );
        return;
      }

      this.sendLatestSamples();
    },
    stopContinuousMeasurement() {
      if (!this.state.continuousActive && this.state.continuousTimer === null) {
        this.setStatus("La medición continua no está activa.");
        return;
      }

      this.state.continuousActive = false;
      this.state.continuousButton.setProperty(prop.TEXT, "Iniciar monitoreo");
      this.state.continuousRunId += 1;
      if (this.state.continuousTimer !== null) {
        clearInterval(this.state.continuousTimer);
        this.state.continuousTimer = null;
      }
      const brightTimeResult = resetPageBrightTime();
      if (brightTimeResult !== 0) {
        logger.error(
          `Could not reset page screen-on time: result=${brightTimeResult}`
        );
      }
      const heartRateStopped = this.stopHeartRate(true);
      const stressStopped = this.stopStressMonitoring(true);
      this.setStatus(
        heartRateStopped && stressStopped
          ? "Medición continua y sensores detenidos."
          : "Ciclo detenido, pero no se pudo apagar un sensor; revisa el reloj."
      );
      logger.log("Continuous measurement stopped");
    },
    sendLatestSamples() {
      if (this.state.sending) {
        this.setStatus("Ya hay un envío en curso.");
        return;
      }

      const samples = [];
      ["heart_rate", "stress"].forEach((metric) => {
        const latest = this.state.latestSamples[metric];
        if (latest) {
          samples.push({
            ...latest,
            sampleId: `${metric}-${latest.measuredAt}`
          });
        }
      });

      if (samples.length === 0) {
        this.setStatus("Aún no hay lecturas para enviar.");
        return;
      }

      this.uploadSamples(samples, true, this.state.continuousRunId);
    },
    uploadSamples(samples, continuous, runId) {
      this.state.sending = true;
      this.setStatus(
        continuous
          ? "Enviando lecturas de este ciclo al servidor..."
          : "Enviando lecturas por Zepp App..."
      );

      let upload = Promise.resolve();
      let uploadedCount = 0;
      samples.forEach((sample) => {
        const uploadSample = {
          ...sample,
          sampleId: `${sample.metric}-${sample.measuredAt}`
        };
        upload = upload.then(() => {
          let request;
          try {
            request = this.request({
              type: "UPLOAD_SAMPLE",
              params: uploadSample
            });
          } catch (error) {
            return Promise.reject(error);
          }

          return request.then((result) => {
            if (!result || result.ok !== true) {
              throw new Error(
                result && result.error
                  ? result.error
                  : "El Side Service no confirmó el envío."
              );
            }
            uploadedCount += 1;
          });
        });
      });

      upload.then(
        () => {
          if (!continuous || runId === this.state.continuousRunId) {
            this.setStatus(
              `${uploadedCount} lectura(s) guardada(s) en el servidor.${
                continuous ? " Próxima lectura en un minuto." : ""
              }`
            );
          }
          this.state.sending = false;
        },
        (error) => {
          logger.error("Could not upload health samples:", error);
          if (!continuous || runId === this.state.continuousRunId) {
            this.setStatus(
              error && error.message
                ? `Error de envío: ${error.message}`
                : "No se pudieron enviar las lecturas."
            );
          }
          this.state.sending = false;
        }
      );
    },
    setStatus(message) {
      if (this.state.statusWidget) {
        this.state.statusWidget.setProperty(prop.TEXT, message);
      }
      if (this.state.statusIndicatorWidget) {
        this.state.statusIndicatorWidget.setProperty(
          prop.COLOR,
          this.state.continuousActive ? 0x31d0c6 : 0x77849a
        );
      }
    },
    onDestroy() {
      this.state.continuousActive = false;
      this.state.continuousRunId += 1;
      if (this.state.continuousTimer !== null) {
        clearInterval(this.state.continuousTimer);
        this.state.continuousTimer = null;
      }
      const brightTimeResult = resetPageBrightTime();
      if (brightTimeResult !== 0) {
        logger.error(
          `Could not reset page screen-on time on destroy: result=${brightTimeResult}`
        );
      }

      if (this.state.heartRateSensor && this.state.heartRateCallback) {
        this.state.heartRateSensor.offCurrentChange(
          this.state.heartRateCallback
        );
      }

      if (this.state.stressSensor && this.state.stressCallback) {
        this.state.stressSensor.offChange(this.state.stressCallback);
      }

      this.state.heartRateSensor = null;
      this.state.heartRateCallback = null;
      this.state.stressSensor = null;
      this.state.stressCallback = null;
      logger.log("Health measurement page destroyed");
    }
  })
);
