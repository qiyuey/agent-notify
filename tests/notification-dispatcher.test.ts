import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationDispatcher } from "../src/dispatcher/notification-dispatcher.js";
import { NotificationDatabase } from "../src/storage/database.js";
import { OutboundNotificationStore } from "../src/storage/notification-store.js";

let database: NotificationDatabase;
let store: OutboundNotificationStore;

beforeEach(() => {
  database = new NotificationDatabase(":memory:");
  store = new OutboundNotificationStore(database);
  store.enqueue(
    { producer: "codex", idempotencyKey: "codex:run:1", title: "Report", message: "Done." },
    1_000,
  );
});

afterEach(() => database.close());

describe("NotificationDispatcher", () => {
  it("sends and acknowledges one notification", async () => {
    const sender = { send: vi.fn(async () => ({ messageId: "message-1" })) };
    const dispatcher = new NotificationDispatcher(store, sender);
    expect(await dispatcher.runOnce(1_100)).toBe(true);
    expect(await dispatcher.runOnce(1_100)).toBe(false);
    expect(store.list("delivered")[0]?.providerMessageId).toBe("message-1");
  });

  it("keeps a failed send retryable", async () => {
    const dispatcher = new NotificationDispatcher(store, {
      send: vi.fn(async () => {
        throw new Error("temporary");
      }),
    });
    await dispatcher.runOnce(1_100);
    expect(store.counts()).toMatchObject({ queued: 1, delivered: 0 });
    expect(store.list("queued")[0]?.lastError).toBe("temporary");
  });
});
