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

  it("delivers a queued notification from the retired Pi integration", async () => {
    const legacy = store.enqueue(
      { producer: "pi", idempotencyKey: "pi:run:1", title: "Legacy report", message: "Done." },
      900,
    );
    const sender = { send: vi.fn(async () => ({ messageId: "legacy-message" })) };
    const dispatcher = new NotificationDispatcher(store, sender);

    expect(await dispatcher.runOnce(1_100)).toBe(true);
    expect(store.list("delivered")).toMatchObject([
      { id: legacy.id, producer: "pi", providerMessageId: "legacy-message" },
    ]);
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
