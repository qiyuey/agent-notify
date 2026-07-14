import { resolveDatabasePath } from "../config/paths.js";
import { GatewayDatabase } from "./database.js";
import { OutboundNotificationStore } from "./notification-store.js";

export function openGatewayDatabase(env: NodeJS.ProcessEnv = process.env): GatewayDatabase {
  return new GatewayDatabase(resolveDatabasePath(env));
}

export function openNotificationStore(env: NodeJS.ProcessEnv = process.env): {
  readonly database: GatewayDatabase;
  readonly store: OutboundNotificationStore;
} {
  const database = openGatewayDatabase(env);
  return { database, store: new OutboundNotificationStore(database) };
}
