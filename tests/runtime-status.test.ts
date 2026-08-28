import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  RuntimeStatusWriter,
  readRuntimeHealth,
  resolveRuntimeStatusPath,
} from "../src/runtime/runtime-status.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("runtime status", () => {
  it("reports a live heartbeat and a clean stop", () => {
    const directory = temporaryDirectory();
    const env = { AGENT_NOTIFY_DATA_DIR: directory };
    const path = resolveRuntimeStatusPath(env);
    const writer = new RuntimeStatusWriter(path, () => 1_000, process.pid);
    writer.start();
    expect(readRuntimeHealth(env, 1_001)).toMatchObject({ running: true, state: "running" });
    writer.stop();
    expect(readRuntimeHealth(env, 1_001)).toMatchObject({ running: false, state: "stopped" });
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({ pid: process.pid });
  });

  it("reports missing, invalid, and stale state safely", () => {
    const directory = temporaryDirectory();
    const env = { AGENT_NOTIFY_DATA_DIR: directory };
    expect(readRuntimeHealth(env)).toMatchObject({ state: "unknown", pid: null });
    writeFileSync(resolveRuntimeStatusPath(env), "{}");
    expect(readRuntimeHealth(env)).toMatchObject({ state: "unknown" });
    writeFileSync(
      resolveRuntimeStatusPath(env),
      JSON.stringify({
        state: "running",
        pid: process.pid,
        runtimeVersion: "0.1.0",
        startedAt: 1,
        heartbeatAt: 1,
      }),
    );
    expect(readRuntimeHealth(env, 30_000)).toMatchObject({ state: "stale", running: false });
  });
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "agent-notify-status-"));
  directories.push(directory);
  return directory;
}
