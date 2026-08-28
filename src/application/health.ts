import { resolveDatabasePath } from "../config/paths.js";
import { AGENT_NOTIFY_RUNTIME_VERSION } from "../core/build-info.js";
import { readRuntimeHealth } from "../runtime/runtime-status.js";
import { OutboundNotificationStore } from "../storage/notification-store.js";
import { openNotificationDatabase } from "../storage/open-store.js";

export function collectHealth(env: NodeJS.ProcessEnv = process.env) {
  const database = openNotificationDatabase(env);
  try {
    const runtime = readRuntimeHealth(env);
    return {
      status: runtime.running ? ("ok" as const) : ("degraded" as const),
      databasePath: resolveDatabasePath(env),
      runtimeVersion: AGENT_NOTIFY_RUNTIME_VERSION,
      runtime,
      notifications: new OutboundNotificationStore(database).counts(),
    };
  } finally {
    database.close();
  }
}
