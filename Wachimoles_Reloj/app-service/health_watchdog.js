import * as appService from "@zos/app-service";
import { log } from "@zos/utils";
import { readWatchdogAlarmId } from "./watchdog_state";

const SERVICE_FILE = "app-service/health_monitor";
const logger = log.getLogger("health-test.watchdog");

function serviceIsRunning() {
  const runningServices = appService.getAllAppServices();
  const normalizeServiceFile = (file) =>
    file.replace(/^\/+/, "").replace(/\.js$/, "");

  return runningServices.some(
    (file) => normalizeServiceFile(file) === normalizeServiceFile(SERVICE_FILE)
  );
}

AppService({
  onInit() {
    let alarmId;
    try {
      alarmId = readWatchdogAlarmId();
    } catch (error) {
      logger.error("Could not read watchdog state:", error);
      return;
    }

    if (!alarmId) {
      logger.log("Watchdog is disabled; not restarting health monitoring");
      return;
    }

    let running;
    try {
      running = serviceIsRunning();
    } catch (error) {
      logger.error("Could not check health monitoring status:", error);
      return;
    }

    if (running) {
      logger.log("Watchdog check: health monitoring is running");
      return;
    }

    logger.log("Watchdog detected stopped health monitoring; restarting");
    try {
      const result = appService.start({
        file: SERVICE_FILE,
        param: "source=watchdog",
        reload: true,
        complete_func: (info) => {
          if (info && info.result === true) {
            logger.log("Watchdog restarted health monitoring");
            return;
          }
          logger.error("Watchdog restart failed:", info);
        }
      });

      if (result !== 0) {
        logger.error(`Watchdog restart returned code ${result}`);
      }
    } catch (error) {
      logger.error("Could not restart health monitoring:", error);
    }
  }
});
