import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { enqueueNotification } from "../src/application/enqueue-notification.js";
import { openNotificationStore } from "../src/storage/open-store.js";

it("deduplicates Codex notifications without colliding with legacy keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-notify-enqueue-"));
  const env = { AGENT_NOTIFY_DATA_DIR: directory };
  try {
    const { database, store } = openNotificationStore(env);
    try {
      const legacy = store.enqueue({
        producer: "pi",
        idempotencyKey: "pi:run-1",
        title: "Legacy report",
        message: "Done.",
      });
      const payload = { title: "Report", message: "Done.", dedupeKey: "run-1" };
      const first = enqueueNotification(payload, env);
      expect(first.notificationId).not.toBe(legacy.id);
      expect(first.duplicate).toBe(false);
      expect(enqueueNotification(payload, env)).toEqual({ ...first, duplicate: true });
      expect(store.findByIdempotencyKey("codex:run-1")?.producer).toBe("codex");
    } finally {
      database.close();
    }
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
