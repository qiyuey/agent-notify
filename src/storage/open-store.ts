import { resolveDatabasePath } from "../config/paths.js";
import { NotificationDatabase } from "./database.js";
import { OutboundNotificationStore } from "./notification-store.js";

export function openNotificationDatabase(
  env: NodeJS.ProcessEnv = process.env,
): NotificationDatabase {
  return new NotificationDatabase(resolveDatabasePath(env));
}

export function openNotificationStore(env: NodeJS.ProcessEnv = process.env): {
  readonly database: NotificationDatabase;
  readonly store: OutboundNotificationStore;
} {
  const database = openNotificationDatabase(env);
  return { database, store: new OutboundNotificationStore(database) };
}
