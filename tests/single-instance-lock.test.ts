import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SingleInstanceLock } from "../src/runtime/single-instance-lock.js";

describe("SingleInstanceLock", () => {
  it("rejects a second live daemon and allows reuse after release", () => {
    const directory = mkdtempSync(join(tmpdir(), "gateway-lock-"));
    const path = join(directory, "daemon.lock");
    try {
      const first = new SingleInstanceLock(path, process.pid);
      const second = new SingleInstanceLock(path, process.pid);
      first.acquire();
      expect(() => second.acquire()).toThrow(`already running with PID ${process.pid}`);
      first.release();
      second.acquire();
      second.release();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("reclaims a legacy lock when its PID was reused by another process", () => {
    const directory = mkdtempSync(join(tmpdir(), "gateway-lock-"));
    const path = join(directory, "daemon.lock");
    try {
      writeFileSync(path, `${process.pid}\n`);
      const lock = new SingleInstanceLock(path, 424242, (pid) =>
        pid === process.pid ? "system_installd" : "node dist/daemon.js",
      );

      lock.acquire();
      lock.release();
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("keeps a legacy lock when the live process identity matches the daemon", () => {
    const directory = mkdtempSync(join(tmpdir(), "gateway-lock-"));
    const path = join(directory, "daemon.lock");
    try {
      writeFileSync(path, `${process.pid}\n`);
      const lock = new SingleInstanceLock(path, 424242, () => "node dist/daemon.js");

      expect(() => lock.acquire()).toThrow(`already running with PID ${process.pid}`);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
