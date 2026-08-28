import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { enqueueNotification } from "../src/application/enqueue-notification.js";
import agentNotifyExtension from "../src/pi/extension.js";
import { openNotificationStore } from "../src/storage/open-store.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.AGENT_NOTIFY_DATA_DIR;
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("agent integrations", () => {
  it("deduplicates within a producer without colliding across agents", () => {
    const env = temporaryEnvironment();
    const first = enqueueNotification("codex", payload(), env);
    expect(enqueueNotification("codex", payload(), env)).toEqual({ ...first, duplicate: true });
    expect(enqueueNotification("pi", payload(), env).notificationId).not.toBe(first.notificationId);
  });

  it("registers a Pi tool that queues notifications with Pi provenance", async () => {
    process.env.AGENT_NOTIFY_DATA_DIR = temporaryEnvironment().AGENT_NOTIFY_DATA_DIR;
    const tools: Array<Parameters<Parameters<typeof agentNotifyExtension>[0]["registerTool"]>[0]> =
      [];
    agentNotifyExtension({ registerTool: (tool) => tools.push(tool) });
    const registered = tools[0];
    if (!registered) throw new Error("Pi delivery tool was not registered");

    const result = await registered.execute("call-1", payload());
    expect(registered.name).toBe("deliver_notification");
    expect(result.content[0]?.text).toContain('"state":"queued"');

    const context = openNotificationStore();
    try {
      expect(context.store.list()[0]).toMatchObject({ producer: "pi", title: "Report" });
    } finally {
      context.database.close();
    }
  });
});

function payload() {
  return { title: "Report", message: "Done.", dedupeKey: "run-1" };
}

function temporaryEnvironment(): NodeJS.ProcessEnv & { AGENT_NOTIFY_DATA_DIR: string } {
  const directory = mkdtempSync(join(tmpdir(), "agent-notify-integration-"));
  directories.push(directory);
  return { AGENT_NOTIFY_DATA_DIR: directory };
}
