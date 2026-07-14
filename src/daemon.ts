#!/usr/bin/env node
import { createLogger, describeError } from "./core/logger.js";
import { createDeliveryApplication } from "./runtime/create-delivery-application.js";

try {
  const application = createDeliveryApplication();
  const stop = (): void => {
    void application.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await application.run();
} catch (error: unknown) {
  createLogger().error("delivery_crashed", describeError(error));
  process.exitCode = 1;
}
