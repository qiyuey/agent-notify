#!/usr/bin/env node
import { parseArgs } from "node:util";
import { collectGatewayHealth } from "./application/health.js";
import { type NotificationState, notificationStates } from "./core/types.js";
import {
  installLaunchdService,
  readLaunchdServiceState,
  restartLaunchdService,
  uninstallLaunchdService,
} from "./runtime/launchd-service.js";
import { openNotificationStore } from "./storage/open-store.js";

const command = process.argv[2] ?? "help";

if (command === "help" || command === "--help" || command === "-h") {
  process.stdout.write(
    "codex-im <command>\n\nCommands:\n  health\n  doctor\n  service status\n  service install [--runtime-root <path>] [--env-file <path>]\n  service restart\n  service uninstall\n  notifications [--state <state>] [--limit <n>]\n  recover\n",
  );
  process.exit(0);
}

try {
  if (command === "service") {
    await runServiceCommand();
  } else if (command === "health" || command === "doctor") {
    const health = collectGatewayHealth();
    printJson(health);
    if (command === "doctor" && health.status !== "ok") process.exitCode = 1;
  } else {
    const context = openNotificationStore();
    try {
      if (command === "notifications") {
        const { values } = parseArgs({
          args: process.argv.slice(3),
          options: { limit: { type: "string", default: "20" }, state: { type: "string" } },
        });
        printJson(
          context.store.list(
            values.state ? parseState(values.state) : undefined,
            Number.parseInt(values.limit, 10),
          ),
        );
      } else if (command === "recover") {
        printJson({ recovered: context.store.recoverExpired() });
      } else {
        throw new Error(`Unknown command: ${command}`);
      }
    } finally {
      context.database.close();
    }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
}

function parseState(value: string): NotificationState {
  if (!notificationStates.includes(value as NotificationState)) {
    throw new Error(`Invalid notification state: ${value}`);
  }
  return value as NotificationState;
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function runServiceCommand(): Promise<void> {
  const action = process.argv[3] ?? "status";
  if (action === "status") return printJson(readLaunchdServiceState());
  if (action === "restart") return printJson(restartLaunchdService());
  if (action === "uninstall") return printJson(uninstallLaunchdService());
  if (action !== "install") throw new Error(`Unknown service command: ${action}`);
  const { values } = parseArgs({
    args: process.argv.slice(4),
    options: {
      "runtime-root": { type: "string", default: process.cwd() },
      "env-file": { type: "string" },
    },
  });
  printJson(
    installLaunchdService({
      runtimeRoot: values["runtime-root"],
      ...(values["env-file"] ? { envFile: values["env-file"] } : {}),
    }),
  );
}
