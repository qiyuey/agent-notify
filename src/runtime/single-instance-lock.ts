import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveDataDirectory } from "../config/paths.js";

export function resolveRuntimeLockPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(resolveDataDirectory(env), "daemon.lock");
}

export class SingleInstanceLock {
  private held = false;
  private readonly identity: string | null;

  constructor(
    private readonly path = resolveRuntimeLockPath(),
    private readonly pid = process.pid,
    private readonly processIdentity: (pid: number) => string | null = readProcessIdentity,
  ) {
    this.identity = processIdentity(pid);
  }

  acquire(): void {
    if (this.held) return;
    mkdirSync(dirname(this.path), { mode: 0o700, recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const fd = openSync(this.path, "wx", 0o600);
        try {
          writeFileSync(fd, `${JSON.stringify({ pid: this.pid, identity: this.identity })}\n`);
        } finally {
          closeSync(fd);
        }
        this.held = true;
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const owner = readOwner(this.path);
        if (owner !== null && isSameProcess(owner, this.identity, this.processIdentity)) {
          throw new Error(`Agent Notify daemon is already running with PID ${owner.pid}`);
        }
        rmSync(this.path, { force: true });
      }
    }
    throw new Error("Unable to acquire Agent Notify daemon lock");
  }

  release(): void {
    if (!this.held) return;
    const owner = readOwner(this.path);
    if (owner?.pid === this.pid) rmSync(this.path, { force: true });
    this.held = false;
  }
}

interface LockOwner {
  readonly pid: number;
  readonly identity: string | null;
}

function readOwner(path: string): LockOwner | null {
  try {
    const raw = readFileSync(path, "utf8").trim();
    if (raw.startsWith("{")) {
      const value = JSON.parse(raw) as { pid?: unknown; identity?: unknown };
      return Number.isSafeInteger(value.pid) && Number(value.pid) > 0
        ? {
            pid: Number(value.pid),
            identity: typeof value.identity === "string" ? value.identity : null,
          }
        : null;
    }
    const pid = Number.parseInt(raw, 10);
    return Number.isSafeInteger(pid) && pid > 0 ? { pid, identity: null } : null;
  } catch {
    return null;
  }
}

function isSameProcess(
  owner: LockOwner,
  expectedIdentity: string | null,
  processIdentity: (pid: number) => string | null,
): boolean {
  if (!isProcessAlive(owner.pid)) return false;
  const actualIdentity = processIdentity(owner.pid);
  if (owner.identity !== null) return actualIdentity === null || actualIdentity === owner.identity;
  return (
    actualIdentity === null || expectedIdentity === null || actualIdentity === expectedIdentity
  );
}

function readProcessIdentity(pid: number): string | null {
  if (process.platform === "win32") return null;
  const result = spawnSync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const command = result.stdout.trim();
  return command || null;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}
