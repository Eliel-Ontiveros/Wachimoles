import { log } from "@zos/utils";
import { BaseApp } from "@zeppos/zml/base/base-app";
import { appPlugin } from "@zeppos/zml/2.0/module/messaging/plugin/app";
import {
  appPlugin as backgroundServiceAppPlugin
} from "@zeppos/zml/3.0/module/app-service/plugin/app";

BaseApp.use(appPlugin);
BaseApp.use((options) => {
  options.$m = options.$m || {};
  return backgroundServiceAppPlugin(options);
});

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
