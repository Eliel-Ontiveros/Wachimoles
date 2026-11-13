import * as appService from "@zos/app-service";
import { getDeviceInfo } from "@zos/device";
import { align, createWidget, widget } from "@zos/ui";
import { log, px } from "@zos/utils";
import { back } from "@zos/router";
import {
  readWatchdogAlarmId,
  writeWatchdogDiagnostic
} from "../app-service/watchdog_state";

const SERVICE_FILE = "app-service/health_monitor";
const logger = log.getLogger("health-test.watchdog.page");
const { width: SCREEN_WIDTH } = getDeviceInfo();

function recordWatchdogResult(status, detail = "") {
  try {
    writeWatchdogDiagnostic(status, detail);
  } catch (error) {
    logger.error("Could not save watchdog diagnostic:", error);
  }
  logger.log(
    `Watchdog page result: ${status}${detail ? `; ${detail}` : ""}`
  );
}

function serviceIsRunning() {
  const runningServices = appService.getAllAppServices();
  const normalizeServiceFile = (file) =>
    file.replace(/^\/+/, "").replace(/\.js$/, "");

  return runningServices.some(
    (file) => normalizeServiceFile(file) === normalizeServiceFile(SERVICE_FILE)
  );
}

function returnToPreviousPage() {
  try {
    back();
  } catch (error) {
    logger.error("Could not close watchdog page:", error);
  }
}

Page({
  onInit() {
    let alarmId;
    try {
      alarmId = readWatchdogAlarmId();
    } catch (error) {
      recordWatchdogResult("state_read_failed");
      logger.error("Could not read watchdog state:", error);
      returnToPreviousPage();
      return;
    }

    if (!alarmId) {
      recordWatchdogResult("disabled");
      returnToPreviousPage();
      return;
    }

    let running;
    try {
      running = serviceIsRunning();
    } catch (error) {
      recordWatchdogResult("service_check_failed");
      logger.error("Could not check health monitoring status:", error);
      returnToPreviousPage();
      return;
    }

    if (running) {
      recordWatchdogResult("monitor_running");
      returnToPreviousPage();
      return;
    }

    let currentAlarmId;
    try {
      currentAlarmId = readWatchdogAlarmId();
    } catch (error) {
      recordWatchdogResult("state_recheck_failed");
      logger.error("Could not recheck watchdog state:", error);
      returnToPreviousPage();
      return;
    }
    if (currentAlarmId !== alarmId) {
      recordWatchdogResult("cancelled_before_restart");
      returnToPreviousPage();
      return;
    }

    recordWatchdogResult("restart_requested");
    try {
      const result = appService.start({
        file: SERVICE_FILE,
        param: "source=watchdog-page",
        reload: true,
        complete_func: (info) => {
          if (info && info.result === true) {
            recordWatchdogResult("restart_succeeded");
          } else {
            recordWatchdogResult("restart_failed");
            logger.error("Watchdog page restart failed:", info);
          }
          returnToPreviousPage();
        }
      });

      if (result !== 0) {
        recordWatchdogResult("restart_start_error", String(result));
        logger.error(`Watchdog page start returned code ${result}`);
        returnToPreviousPage();
      }
    } catch (error) {
      recordWatchdogResult(
        "restart_exception",
        error && error.message ? error.message : String(error)
      );
      logger.error("Could not restart health monitoring:", error);
      returnToPreviousPage();
    }
  },
  build() {
    createWidget(widget.TEXT, {
      x: px(20),
      y: px(100),
      w: SCREEN_WIDTH - px(40),
      h: px(60),
      text: "Comprobando monitoreo...",
      text_size: px(18),
      color: 0xffffff,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V
    });
  }
});