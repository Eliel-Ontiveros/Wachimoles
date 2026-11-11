import { HeartRate, Stress, Time } from "@zos/sensor";
import { log } from "@zos/utils";

const logger = log.getLogger("wachimoles.bg-test.service");

AppService({
  state: {
    heartRateSensor: null,
    heartRateCallback: null,
    stressSensor: null,
    stressCallback: null,
    timeSensor: null
  },
  onInit(param) {
    logger.log(`Background health monitor started: ${param || "no parameters"}`);

    try {
      const sensor = new HeartRate();
      const callback = () => {
        try {
          const value = sensor.getCurrent();
          if (Number.isFinite(value) && value > 0) {
            logger.log(`Background heart rate: ${value} bpm at ${Date.now()}`);
          }
        } catch (error) {
          logger.error("Could not read background heart rate:", error);
        }
      };

      sensor.onCurrentChange(callback);
      this.state.heartRateSensor = sensor;
      this.state.heartRateCallback = callback;
      logger.log("Background heart-rate listener registered");
    } catch (error) {
      logger.error("Could not start background heart-rate listener:", error);
    }

    try {
      const sensor = new Stress();
      const callback = () => {
        try {
          const result = sensor.getCurrent();
          if (result && Number.isFinite(result.value) && result.value >= 0) {
            logger.log(
              `Background stress: ${result.value} at ${result.time || Date.now()}`
            );
          }
        } catch (error) {
          logger.error("Could not read background stress:", error);
        }
      };

      sensor.onChange(callback);
      this.state.stressSensor = sensor;
      this.state.stressCallback = callback;
      logger.log("Background stress listener registered");
    } catch (error) {
      logger.error("Could not start background stress listener:", error);
    }

    try {
      const sensor = new Time();
      const callback = () => {
        logger.log(`Background service heartbeat at ${Date.now()}`);
      };

      sensor.onPerMinute(callback);
      this.state.timeSensor = sensor;
      logger.log("Background minute heartbeat registered");
    } catch (error) {
      logger.error("Could not register background minute heartbeat:", error);
    }
  },
  onDestroy() {
    if (this.state.heartRateSensor && this.state.heartRateCallback) {
      try {
        this.state.heartRateSensor.offCurrentChange(
          this.state.heartRateCallback
        );
      } catch (error) {
        logger.error("Could not remove background heart-rate listener:", error);
      }
    }

    if (this.state.stressSensor && this.state.stressCallback) {
      try {
        this.state.stressSensor.offChange(this.state.stressCallback);
      } catch (error) {
        logger.error("Could not remove background stress listener:", error);
      }
    }

    logger.log("Background health monitor destroyed");
  }
});
