import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveDataDirectory } from "../config/paths.js";
import { GATEWAY_RUNTIME_VERSION } from "../core/build-info.js";

export interface RuntimeHealth {
  readonly running: boolean;
  readonly state: "running" | "stopped" | "stale" | "unknown";
  readonly pid: number | null;
  readonly runtimeVersion: string | null;
  readonly heartbeatAt: number | null;
  readonly heartbeatAgeMs: number | null;
}

interface RuntimeStatusRecord {
  readonly state: "running" | "stopped";
  readonly pid: number;
  readonly runtimeVersion: string;
  readonly startedAt: number;
  readonly heartbeatAt: number;
}

export function resolveRuntimeStatusPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveDataDirectory(env), "runtime-status.json");
}

export class RuntimeStatusWriter {
  private readonly startedAt = Date.now();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly path = resolveRuntimeStatusPath(),
    private readonly now: () => number = Date.now,
    private readonly pid = process.pid,
  ) {}

  start(): void {
    if (this.timer) return;
    this.write("running");
    this.timer = setInterval(() => this.write("running"), 5_000);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.write("stopped");
  }

  private write(state: RuntimeStatusRecord["state"]): void {
    const record: RuntimeStatusRecord = {
      state,
      pid: this.pid,
      runtimeVersion: GATEWAY_RUNTIME_VERSION,
      startedAt: this.startedAt,
      heartbeatAt: this.now(),
    };
    mkdirSync(dirname(this.path), { mode: 0o700, recursive: true });
    const temporaryPath = `${this.path}.${this.pid}.tmp`;
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
      chmodSync(temporaryPath, 0o600);
      renameSync(temporaryPath, this.path);
    } finally {
      rmSync(temporaryPath, { force: true });
    }
  }
}

export function readRuntimeHealth(
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): RuntimeHealth {
  const record = readRecord(resolveRuntimeStatusPath(env));
  if (!record) return unknownHealth();
  const heartbeatAgeMs = Math.max(0, now - record.heartbeatAt);
  const running =
    record.state === "running" && heartbeatAgeMs <= 20_000 && isProcessAlive(record.pid);
  return {
    running,
    state: running ? "running" : record.state === "stopped" ? "stopped" : "stale",
    pid: record.pid,
    runtimeVersion: record.runtimeVersion,
    heartbeatAt: record.heartbeatAt,
    heartbeatAgeMs,
  };
}

function readRecord(path: string): RuntimeStatusRecord | null {
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as Partial<RuntimeStatusRecord>;
    return (value.state === "running" || value.state === "stopped") &&
      typeof value.pid === "number" &&
      typeof value.runtimeVersion === "string" &&
      typeof value.startedAt === "number" &&
      typeof value.heartbeatAt === "number"
      ? (value as RuntimeStatusRecord)
      : null;
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function unknownHealth(): RuntimeHealth {
  return {
    running: false,
    state: "unknown",
    pid: null,
    runtimeVersion: null,
    heartbeatAt: null,
    heartbeatAgeMs: null,
  };
}
