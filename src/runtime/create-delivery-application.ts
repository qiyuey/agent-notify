import { DeliveryApplication } from "../application/delivery-application.js";
import { loadRuntimeConfig } from "../config/runtime-config.js";
import { createLogger } from "../core/logger.js";
import { NotificationDispatcher } from "../dispatcher/notification-dispatcher.js";
import { OutboundNotificationStore } from "../storage/notification-store.js";
import { openGatewayDatabase } from "../storage/open-store.js";
import { TelegramNotificationSender } from "../telegram/notification-sender.js";
import { TelegramClient } from "../telegram/telegram-client.js";
import { RuntimeStatusWriter, resolveRuntimeStatusPath } from "./runtime-status.js";
import { resolveRuntimeLockPath, SingleInstanceLock } from "./single-instance-lock.js";

export function createDeliveryApplication(
  env: NodeJS.ProcessEnv = process.env,
): DeliveryApplication {
  const config = loadRuntimeConfig(env);
  const database = openGatewayDatabase(env);
  const logger = createLogger();
  return new DeliveryApplication({
    dispatchIntervalMs: config.dispatchIntervalMs,
    database,
    dispatcher: new NotificationDispatcher(
      new OutboundNotificationStore(database),
      new TelegramNotificationSender(
        new TelegramClient(config.telegramBotToken),
        config.telegramChatId,
      ),
      logger,
    ),
    runtimeStatus: new RuntimeStatusWriter(resolveRuntimeStatusPath(env)),
    instanceLock: new SingleInstanceLock(resolveRuntimeLockPath(env)),
    logger,
  });
}
