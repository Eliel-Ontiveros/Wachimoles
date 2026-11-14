import {
  BloodOxygen,
  HeartRate,
  Sleep,
  Step,
  Stress,
  Time
} from "@zos/sensor";
import { exit } from "@zos/app-service";
import { log } from "@zos/utils";
import { BasePage } from "@zeppos/zml/base/base-page";
import { pagePlugin } from "@zeppos/zml/2.0/module/messaging/plugin/page";
import {
  appServicePlugin,
  BgService
} from "@zeppos/zml/3.0/module/app-service/plugin/app-service";
import { SAMPLE_API_URL } from "../app-side/config";

BasePage.use(pagePlugin);
BasePage.use(appServicePlugin);

const logger = log.getLogger("health-test.background");
const UPLOAD_INTERVAL_MS = 60 * 1000;
const MAX_HEART_RATE_AGE_MS = 5 * UPLOAD_INTERVAL_MS;
const SPO2_LOOKBACK_HOURS = 24;
const SPO2_STARTUP_LOOKBACK_SECONDS = 10 * 60;
const SLEEP_UPLOAD_INTERVAL_MINUTES = 30;
const MINUTOS_POR_DIA = 24 * 60;
const TOLERANCIA_FIN_SUENO_MINUTOS = 5;

function calcularDuracionTramoMinutos(inicio, fin, esInclusivo = false) {
  if (!Number.isFinite(inicio) || !Number.isFinite(fin)) {
    return 0;
  }
  const diferenciaBase =
    fin >= inicio ? fin - inicio : fin + MINUTOS_POR_DIA - inicio;
  const duracion = esInclusivo ? diferenciaBase + 1 : diferenciaBase;
  return duracion > 0 && duracion <= MINUTOS_POR_DIA ? duracion : 0;
}

function determinarEtapasInclusivas(etapasValidas, info, constantesEtapa) {
  if (
    info &&
    Number.isFinite(info.deepTime) &&
    info.deepTime > 0 &&
    constantesEtapa &&
    Number.isFinite(constantesEtapa.DEEP_STAGE)
  ) {
    const etapasProfundas = etapasValidas.filter(
      (etapa) => etapa.model === constantesEtapa.DEEP_STAGE
    );
    if (etapasProfundas.length > 0) {
      let sumaBase = 0;
      let sumaInclusiva = 0;
      etapasProfundas.forEach((etapa) => {
        sumaBase += calcularDuracionTramoMinutos(etapa.start, etapa.stop, false);
        sumaInclusiva += calcularDuracionTramoMinutos(
          etapa.start,
          etapa.stop,
          true
        );
      });
      const diferenciaBase = Math.abs(sumaBase - info.deepTime);
      const diferenciaInclusiva = Math.abs(sumaInclusiva - info.deepTime);
      if (diferenciaInclusiva < diferenciaBase) {
        return true;
      }
      if (diferenciaBase < diferenciaInclusiva) {
        return false;
      }
    }
  }

  if (etapasValidas.length >= 2) {
    let paresInclusivos = 0;
    let paresContinuos = 0;
    for (let indice = 1; indice < etapasValidas.length; indice += 1) {
      const anterior = etapasValidas[indice - 1];
      const actual = etapasValidas[indice];
      const inicioActual =
        ((actual.start % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
      const finAnterior =
        ((anterior.stop % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
      if (inicioActual === (finAnterior + 1) % MINUTOS_POR_DIA) {
        paresInclusivos += 1;
      } else if (inicioActual === finAnterior) {
        paresContinuos += 1;
      }
    }
    if (paresInclusivos > paresContinuos) {
      return true;
    }
    if (paresContinuos > paresInclusivos) {
      return false;
    }
  }

  if (info && Number.isFinite(info.totalTime) && info.totalTime > 0) {
    let totalBase = 0;
    let totalInclusivo = 0;
    etapasValidas.forEach((etapa) => {
      totalBase += calcularDuracionTramoMinutos(etapa.start, etapa.stop, false);
      totalInclusivo += calcularDuracionTramoMinutos(
        etapa.start,
        etapa.stop,
        true
      );
    });
    if (
      Math.abs(totalInclusivo - info.totalTime) <
      Math.abs(totalBase - info.totalTime)
    ) {
      return true;
    }
  }

  return false;
}

function obtenerLecturaSuenoEfectiva(sensorSueno) {
  if (typeof sensorSueno.updateInfo === "function") {
    try {
      sensorSueno.updateInfo();
    } catch (error) {
      logger.error("Could not refresh system sleep info:", error);
    }
  }

  const info =
    typeof sensorSueno.getInfo === "function" ? sensorSueno.getInfo() : null;
  const constantesEtapa =
    typeof sensorSueno.getStageConstantObj === "function"
      ? sensorSueno.getStageConstantObj()
      : null;
  const etapas =
    typeof sensorSueno.getStage === "function" ? sensorSueno.getStage() : null;

  const etapasValidas = Array.isArray(etapas)
    ? etapas.filter(
        (etapa) =>
          etapa &&
          Number.isFinite(etapa.model) &&
          Number.isFinite(etapa.start) &&
          Number.isFinite(etapa.stop)
      )
    : [];

  let minutosSuenoEfectivo = 0;
  let minutosDespierto = 0;
  let finSuenoMinuto =
    info && Number.isFinite(info.endTime) ? info.endTime : null;

  if (etapasValidas.length > 0) {
    const esInclusivo = determinarEtapasInclusivas(
      etapasValidas,
      info,
      constantesEtapa
    );
    const codigoDespierto =
      constantesEtapa && Number.isFinite(constantesEtapa.WAKE_STAGE)
        ? constantesEtapa.WAKE_STAGE
        : null;
    const codigosSueno = new Set(
      [
        constantesEtapa && constantesEtapa.LIGHT_STAGE,
        constantesEtapa && constantesEtapa.DEEP_STAGE,
        constantesEtapa && constantesEtapa.REM_STAGE
      ].filter((codigo) => Number.isFinite(codigo))
    );

    etapasValidas.forEach((etapa) => {
      const duracion = calcularDuracionTramoMinutos(
        etapa.start,
        etapa.stop,
        esInclusivo
      );
      if (duracion <= 0) {
        return;
      }

      if (codigoDespierto !== null && etapa.model === codigoDespierto) {
        minutosDespierto += duracion;
        return;
      }

      if (codigosSueno.size > 0) {
        if (codigosSueno.has(etapa.model)) {
          minutosSuenoEfectivo += duracion;
        }
      } else {
        minutosSuenoEfectivo += duracion;
      }
    });

    const ultimaEtapa = etapasValidas[etapasValidas.length - 1];
    if (finSuenoMinuto === null && ultimaEtapa) {
      finSuenoMinuto = ultimaEtapa.stop;
    }
  }

  const tiempoTotalInfo =
    info && Number.isFinite(info.totalTime) ? info.totalTime : 0;

  if (minutosSuenoEfectivo <= 0 && tiempoTotalInfo > 0) {
    if (minutosDespierto > 0 && tiempoTotalInfo > minutosDespierto) {
      minutosSuenoEfectivo = tiempoTotalInfo - minutosDespierto;
    } else {
      minutosSuenoEfectivo = tiempoTotalInfo;
    }
  }

  return {
    minutosSuenoEfectivo,
    minutosDespierto,
    tiempoTotalInfo,
    finSuenoMinuto
  };
}

function parseResponseBody(body) {
  const parsed = typeof body === "string" ? JSON.parse(body) : body;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("The server returned an empty or invalid response.");
  }
  return parsed;
}

function createSampleId(sample) {
  return sample.sampleId || `${sample.metric}-${sample.measuredAt}`;
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function publishToPage(message) {
  try {
    BgService.postMessage(message);
  } catch (error) {
    logger.error("Could not publish background service update:", error);
  }
}

function uploadSample(service, sample) {
  const payload = {
    ...sample,
    sampleId: createSampleId(sample)
  };

  return service.httpRequest({
    url: SAMPLE_API_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    timeout: 15000
  }).then((response) => {
    if (!response || response.status < 200 || response.status >= 300) {
      throw new Error(
        `Sample request failed with HTTP status ${response && response.status}.`
      );
    }

    const result = parseResponseBody(response.body);
    if (result.ok !== true) {
      throw new Error(result.error || "The server rejected the sample.");
    }

    logger.log(
      `Uploaded ${payload.sampleId}; duplicate=${result.duplicate === true}`
    );
    return payload.sampleId;
  });
}

function stopSensors(state) {
  if (state.heartRateSensor && state.heartRateCallback) {
    try {
      state.heartRateSensor.offLastChange(state.heartRateCallback);
    } catch (error) {
      logger.error("Could not stop background heart-rate listener:", error);
    }
  }
  if (state.stressSensor && state.stressCallback) {
    try {
      state.stressSensor.offChange(state.stressCallback);
    } catch (error) {
      logger.error("Could not stop background stress sensor:", error);
    }
  }
  state.heartRateSensor = null;
  state.heartRateCallback = null;
  state.stressSensor = null;
  state.stressCallback = null;
}

AppService(
  BasePage({
    state: {
      heartRateSensor: null,
      heartRateCallback: null,
      stepSensor: null,
      spo2Sensor: null,
      sleepSensor: null,
      stressSensor: null,
      stressCallback: null,
      latestSamples: {
        heart_rate: null,
        stress: null,
        steps: null,
        spo2: null,
        sleep: null
      },
      lastUploaded: {
        heart_rate: null,
        stress: null,
        steps: null,
        spo2: null,
        sleep: null
      },
      uploadsInFlight: {
        heart_rate: false,
        stress: false,
        steps: false,
        spo2: false,
        sleep: false
      },
      lastSpo2SensorTime: null,
      ultimoValorSuenoSubido: null,
      sleepMinuteTicks: 0,
      timeSensor: null,
      timeCallback: null
    },
    onInit(param) {
      const service = this;
      logger.log(`Background health monitoring started: ${param || "manual"}`);
      BgService.onMessage = (message) => {
        if (message && message.type === "GET_LATEST") {
          const lecturaSueno = service.captureSleepReading("page request");
          if (lecturaSueno) {
            const cambioSueno =
              service.state.lastUploaded.sleep !== lecturaSueno.sampleId ||
              service.state.ultimoValorSuenoSubido !== lecturaSueno.value;
            if (cambioSueno) {
              service.uploadSampleIfNeeded(lecturaSueno, true);
            }
          }
          Object.keys(service.state.latestSamples).forEach((metric) => {
            const sample = service.state.latestSamples[metric];
            if (sample) {
              publishToPage({ type: "SAMPLE", sample });
            }
          });
        }
      };

      try {
        const sensor = new HeartRate();
        const callback = () => {
          const sample =
            this.captureLastHeartRateReading("sensor change") ||
            this.captureHeartRateReading("sensor change");
          if (sample) {
            this.uploadSampleIfNeeded(sample, true);
          }
        };
        this.state.heartRateSensor = sensor;
        this.state.heartRateCallback = callback;
        sensor.onLastChange(callback);
        const initialHeartRate = this.captureHeartRateReading("initial");
        if (initialHeartRate) {
          this.uploadSampleIfNeeded(initialHeartRate, true);
        }
        logger.log("Background heart-rate history listener initialized");
      } catch (error) {
        logger.error("Could not start background heart-rate sensor:", error);
      }

      try {
        this.state.stepSensor = new Step();
        logger.log("Background step counter initialized");
      } catch (error) {
        logger.error("Could not initialize background step counter:", error);
      }

      try {
        this.state.sleepSensor = new Sleep();
        logger.log("Background sleep history reader initialized");
      } catch (error) {
        logger.error("Could not initialize background sleep reader:", error);
      }

      try {
        this.state.spo2Sensor = new BloodOxygen();
        this.state.lastSpo2SensorTime =
          Math.floor(Date.now() / 1000) - SPO2_STARTUP_LOOKBACK_SECONDS;
        logger.log("Background SpO2 history reader initialized");
        this.captureSpo2Readings("initial");
      } catch (error) {
        logger.error("Could not initialize background SpO2 history:", error);
      }

      try {
        const sensor = new Stress();
        const callback = () => this.captureStressReading("change");

        this.state.stressSensor = sensor;
        this.state.stressCallback = callback;
        sensor.onChange(callback);
        logger.log("Background stress listener registered");
        this.captureStressReading("initial");
      } catch (error) {
        logger.error("Could not start background stress sensor:", error);
      }

      if (!this.state.heartRateSensor || !this.state.stressSensor) {
        stopSensors(this.state);
        logger.error("Background monitoring stopped because a sensor failed.");
        publishToPage({ type: "STATUS", active: false });
        exit();
        return;
      }

      try {
        const timeSensor = new Time();
        const callback = () => {
          this.state.sleepMinuteTicks += 1;
          this.runUploadCycle();
        };
        timeSensor.onPerMinute(callback);
        this.state.timeSensor = timeSensor;
        this.state.timeCallback = callback;
        logger.log("Background upload schedule registered for each minute");
        publishToPage({ type: "STATUS", active: true });
      } catch (error) {
        logger.error(
          "Could not register background upload schedule:",
          error && error.message ? error.message : String(error)
        );
        publishToPage({
          type: "STATUS",
          active: true,
          warning: "La medición sigue activa, pero el envío periódico no está disponible."
        });
      }

      const initialSteps = this.captureStepReading("initial");
      if (initialSteps) {
        this.uploadSampleIfNeeded(initialSteps, true);
      }
      const initialSleep = this.captureSleepReading("initial");
      if (initialSleep) {
        this.uploadSampleIfNeeded(initialSleep, true);
      }
    },
    captureLastHeartRateReading(source) {
      if (!this.state.heartRateSensor) {
        return null;
      }

      try {
        const value = this.state.heartRateSensor.getLast();
        if (!Number.isFinite(value) || value <= 0 || value > 250) {
          logger.log(`No valid latest heart-rate reading is available (${source})`);
          return null;
        }

        const sample = {
          metric: "heart_rate",
          value,
          unit: "bpm",
          measuredAt: Date.now()
        };
        this.state.latestSamples.heart_rate = sample;
        publishToPage({ type: "SAMPLE", sample });
        logger.log(`Latest heart rate read: ${value} bpm (${source})`);
        return sample;
      } catch (error) {
        logger.error(
          `Could not read latest heart-rate measurement (${source}):`,
          error
        );
        return null;
      }
    },
    captureSleepReading(source) {
      if (!this.state.sleepSensor) {
        return null;
      }

      try {
        const lecturaSueno = obtenerLecturaSuenoEfectiva(this.state.sleepSensor);
        const minutosEfectivos = lecturaSueno.minutosSuenoEfectivo;
        if (
          !Number.isFinite(minutosEfectivos) ||
          minutosEfectivos <= 0 ||
          minutosEfectivos > MINUTOS_POR_DIA
        ) {
          logger.log(`No valid system sleep duration is available (${source})`);
          return null;
        }

        const ahora = new Date();
        const minutoActualDia = ahora.getHours() * 60 + ahora.getMinutes();
        const fechaMuestra = new Date(ahora.getTime());
        let instanteMedicion = ahora.getTime();

        if (
          Number.isFinite(lecturaSueno.finSuenoMinuto) &&
          lecturaSueno.finSuenoMinuto >= 0 &&
          lecturaSueno.finSuenoMinuto < MINUTOS_POR_DIA &&
          lecturaSueno.finSuenoMinuto >
            minutoActualDia + TOLERANCIA_FIN_SUENO_MINUTOS
        ) {
          fechaMuestra.setDate(fechaMuestra.getDate() - 1);
          instanteMedicion = new Date(
            fechaMuestra.getFullYear(),
            fechaMuestra.getMonth(),
            fechaMuestra.getDate(),
            Math.floor(lecturaSueno.finSuenoMinuto / 60),
            lecturaSueno.finSuenoMinuto % 60
          ).getTime();
        }

        const sample = {
          metric: "sleep",
          value: Math.round((minutosEfectivos / 60) * 100) / 100,
          unit: "hours",
          measuredAt: instanteMedicion,
          sampleId: `sleep-${getLocalDateKey(fechaMuestra)}`
        };
        this.state.latestSamples.sleep = sample;
        publishToPage({ type: "SAMPLE", sample });
        logger.log(
          `System sleep duration read: ${sample.value} hours (effective=${minutosEfectivos}m, awake=${lecturaSueno.minutosDespierto}m, total=${lecturaSueno.tiempoTotalInfo}m, source=${source})`
        );
        return sample;
      } catch (error) {
        logger.error(`Could not read system sleep duration (${source}):`, error);
        return null;
      }
    },
    captureHeartRateReading(source) {
      if (!this.state.heartRateSensor) {
        return null;
      }

      try {
        const readings = this.state.heartRateSensor.getToday();
        if (!Array.isArray(readings)) {
          throw new Error("Heart-rate history did not return an array.");
        }

        const now = new Date();
        const currentMinute = now.getHours() * 60 + now.getMinutes();
        const firstCandidate = Math.min(currentMinute, readings.length - 1);
        const earliestMinute = Math.max(
          0,
          currentMinute - MAX_HEART_RATE_AGE_MS / UPLOAD_INTERVAL_MS
        );
        let latestMinute = -1;

        for (let minute = firstCandidate; minute >= earliestMinute; minute -= 1) {
          const value = readings[minute];
          if (Number.isFinite(value) && value > 0 && value <= 250) {
            latestMinute = minute;
            break;
          }
        }

        if (latestMinute < 0) {
          this.state.latestSamples.heart_rate = null;
          publishToPage({
            type: "SAMPLE_UNAVAILABLE",
            metric: "heart_rate"
          });
          logger.log(`No recent system heart-rate reading is available (${source})`);
          return null;
        }

        const measuredAt =
          new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() +
          latestMinute * UPLOAD_INTERVAL_MS;
        const sample = {
          metric: "heart_rate",
          value: readings[latestMinute],
          unit: "bpm",
          measuredAt
        };
        this.state.latestSamples.heart_rate = sample;
        publishToPage({ type: "SAMPLE", sample });
        logger.log(
          `System heart rate read: ${sample.value} bpm for minute ${latestMinute}`
        );
        return sample;
      } catch (error) {
        logger.error(
          `Could not read system heart-rate history (${source}):`,
          error
        );
        return null;
      }
    },
    captureStressReading(source) {
      if (!this.state.stressSensor) {
        return;
      }

      try {
        const result = this.state.stressSensor.getCurrent();
        if (
          !result ||
          !Number.isFinite(result.value) ||
          result.value < 0
        ) {
          logger.log(`Background stress reading unavailable (${source})`);
          return;
        }

        const sample = {
          metric: "stress",
          value: result.value,
          unit: "score",
          measuredAt: Date.now()
        };
        if (Number.isSafeInteger(result.time)) {
          sample.sensorTime = result.time;
        }
        this.state.latestSamples.stress = sample;
        publishToPage({ type: "SAMPLE", sample });
        logger.log(`Background stress updated: ${result.value}`);
      } catch (error) {
        logger.error(`Could not read background stress (${source}):`, error);
      }
    },
    captureStepReading(source) {
      if (!this.state.stepSensor) {
        return null;
      }

      try {
        const value = this.state.stepSensor.getCurrent();
        if (!Number.isSafeInteger(value) || value < 0) {
          logger.log(`Ignoring invalid step count (${source})`);
          return null;
        }

        const now = new Date();
        const sample = {
          metric: "steps",
          value,
          unit: "steps",
          measuredAt: now.getTime(),
          sampleId: `steps-${getLocalDateKey(now)}`
        };
        this.state.latestSamples.steps = sample;
        publishToPage({ type: "SAMPLE", sample });
        logger.log(`Background steps updated: ${value} (${source})`);
        return sample;
      } catch (error) {
        logger.error(`Could not read background steps (${source}):`, error);
        return null;
      }
    },
    captureSpo2Readings(source) {
      if (!this.state.spo2Sensor) {
        return;
      }

      try {
        const readings = this.state.spo2Sensor.getLastFewHour(
          SPO2_LOOKBACK_HOURS
        );
        if (!Array.isArray(readings)) {
          throw new Error("SpO2 history did not return an array.");
        }

        const pending = readings
          .filter(
            (reading) =>
              reading &&
              Number.isSafeInteger(reading.time) &&
              reading.time > this.state.lastSpo2SensorTime &&
              Number.isFinite(reading.spo2) &&
              reading.spo2 > 0 &&
              reading.spo2 <= 100
          )
          .sort((left, right) => left.time - right.time)
          .map((reading) => ({
            metric: "spo2",
            value: reading.spo2,
            unit: "%",
            measuredAt: reading.time * 1000,
            sensorTime: reading.time
          }));

        if (pending.length === 0) {
          logger.log(`No new system SpO2 readings (${source})`);
          return;
        }

        pending.forEach((sample) => {
          this.state.latestSamples.spo2 = sample;
          publishToPage({ type: "SAMPLE", sample });
        });
        this.uploadSpo2Readings(pending);
      } catch (error) {
        logger.error(`Could not read system SpO2 history (${source}):`, error);
      }
    },
    uploadSpo2Readings(samples) {
      if (this.state.uploadsInFlight.spo2) {
        return;
      }

      this.state.uploadsInFlight.spo2 = true;
      let upload = Promise.resolve();
      samples.forEach((sample) => {
        upload = upload.then(() => {
          if (sample.sensorTime <= this.state.lastSpo2SensorTime) {
            return;
          }
          return uploadSample(this, sample).then(() => {
            this.state.lastSpo2SensorTime = sample.sensorTime;
            this.state.lastUploaded.spo2 = createSampleId(sample);
          });
        });
      });

      upload.then(
        () => {
          this.state.uploadsInFlight.spo2 = false;
        },
        (error) => {
          this.state.uploadsInFlight.spo2 = false;
          logger.error("Background SpO2 upload failed:", error);
        }
      );
    },
    uploadSampleIfNeeded(sample, allowSameId = false) {
      const metric = sample.metric;
      const sampleId = createSampleId(sample);
      if (
        (!allowSameId && this.state.lastUploaded[metric] === sampleId) ||
        this.state.uploadsInFlight[metric]
      ) {
        return;
      }

      this.state.uploadsInFlight[metric] = true;
      uploadSample(this, sample).then(
        (uploadedSampleId) => {
          this.state.lastUploaded[metric] = uploadedSampleId;
          if (metric === "sleep") {
            this.state.ultimoValorSuenoSubido = sample.value;
          }
          this.state.uploadsInFlight[metric] = false;
        },
        (error) => {
          this.state.uploadsInFlight[metric] = false;
          logger.error(`Background ${metric} upload failed:`, error);
        }
      );
    },
    runUploadCycle() {
      logger.log(`Background upload cycle tick at ${Date.now()}`);
      this.captureHeartRateReading("scheduled");
      this.captureStressReading("scheduled");
      this.captureSpo2Readings("scheduled");
      const heartRate = this.state.latestSamples.heart_rate;
      const stress = this.state.latestSamples.stress;
      const samples = [];

      if (heartRate) {
        if (Date.now() - heartRate.measuredAt <= MAX_HEART_RATE_AGE_MS) {
          samples.push(heartRate);
        } else {
          logger.log("Skipping stale background heart-rate sample");
        }
      } else {
        logger.log("No background heart-rate sample is available yet");
      }

      if (stress) {
        samples.push(stress);
      } else {
        logger.log("No background stress sample is available yet");
      }

      const steps = this.captureStepReading("scheduled");
      if (steps) {
        this.uploadSampleIfNeeded(steps, true);
      }

      const sleep = this.captureSleepReading("scheduled");
      if (sleep) {
        const cambioSueno =
          this.state.lastUploaded.sleep !== sleep.sampleId ||
          this.state.ultimoValorSuenoSubido !== sleep.value;
        if (
          cambioSueno ||
          this.state.sleepMinuteTicks >= SLEEP_UPLOAD_INTERVAL_MINUTES
        ) {
          this.state.sleepMinuteTicks = 0;
          this.uploadSampleIfNeeded(sleep, true);
        }
      }

      let uploadCount = 0;
      samples.forEach((sample) => {
        if (!this.state.uploadsInFlight[sample.metric]) {
          uploadCount += 1;
        }
        this.uploadSampleIfNeeded(sample);
      });

      logger.log(
        `Background upload cycle started: ${uploadCount} sample(s) eligible`
      );
    },
    onDestroy() {
      this.state.timeSensor = null;
      this.state.timeCallback = null;

      stopSensors(this.state);
      this.state.stepSensor = null;
      this.state.spo2Sensor = null;
      this.state.sleepSensor = null;
      BgService.onMessage = null;
      publishToPage({ type: "STATUS", active: false });
      logger.log("Background health monitoring stopped");
    }
  })
);
