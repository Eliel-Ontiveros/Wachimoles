import { log } from "@zos/utils";
import { BaseApp } from "@zeppos/zml/base/base-app";
import { appPlugin } from "@zeppos/zml/2.0/module/messaging/plugin/app";

BaseApp.use(appPlugin);

const logger = log.getLogger("hr-test.app");

App(
  BaseApp({
    globalData: {},
    onCreate() {
      logger.log("Application started");
    },
    onDestroy() {
      logger.log("Application stopped");
    }
  })
);
