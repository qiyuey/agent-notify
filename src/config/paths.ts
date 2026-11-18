import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function resolveDataDirectory(env: NodeJS.ProcessEnv = process.env): string {
  // Codex assigns PLUGIN_DATA to its own directory, separate from the daemon's queue.
  const configured = env.AGENT_NOTIFY_DATA_DIR ?? env.CODEX_IM_DATA_DIR;
  if (configured && configured.trim().length > 0) {
    return resolve(configured);
  }
  const current = join(homedir(), ".local", "share", "agent-notify");
  const legacy = join(homedir(), ".local", "share", "codex-im");
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}

export function resolveDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  const directory = resolveDataDirectory(env);
  const current = join(directory, "notifications.sqlite");
  const legacy = join(directory, "gateway.sqlite");
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}
