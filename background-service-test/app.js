import { log } from "@zos/utils";

const logger = log.getLogger("wachimoles.bg-test.app");

App({
  globalData: {},
  onCreate() {
    logger.log("Background service test app started");
  },
  onDestroy() {
    logger.log("Background service test app destroyed; service is not stopped here");
  }
});
