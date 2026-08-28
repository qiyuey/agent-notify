import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotificationDatabase } from "../src/storage/database.js";
import { OutboundNotificationStore } from "../src/storage/notification-store.js";

let database: NotificationDatabase;
let store: OutboundNotificationStore;

beforeEach(() => {
  database = new NotificationDatabase(":memory:");
  store = new OutboundNotificationStore(database);
});

afterEach(() => database.close());

describe("OutboundNotificationStore", () => {
  it("deduplicates, leases, and records provider delivery", () => {
    const first = enqueue();
    expect(enqueue().id).toBe(first.id);
    const leased = store.leaseNext({ now: 1_100, leaseDurationMs: 500 });
    if (!leased?.leaseToken) throw new Error("Expected lease");
    expect(store.markDelivered(leased.id, leased.leaseToken, "42", 1_200)).toMatchObject({
      state: "delivered",
      providerMessageId: "42",
    });
  });

  it("recovers expired leases and redacts retry errors", () => {
    enqueue();
    const leased = store.leaseNext({ now: 1_100, leaseDurationMs: 100 });
    if (!leased?.leaseToken) throw new Error("Expected lease");
    expect(
      store.markFailed(leased.id, leased.leaseToken, "token=secret", {
        now: 1_150,
        baseDelayMs: 10,
        random: () => 0,
      }),
    ).toMatchObject({ state: "queued", lastError: "token=[REDACTED]" });
    const retried = store.leaseNext({ now: 2_000, leaseDurationMs: 100 });
    expect(retried?.attemptCount).toBe(2);
    expect(store.recoverExpired(2_101)).toBe(1);
  });

  it("dead-letters after the configured attempt limit", () => {
    enqueue();
    const leased = store.leaseNext({ now: 1_100 });
    if (!leased?.leaseToken) throw new Error("Expected lease");
    expect(
      store.markFailed(leased.id, leased.leaseToken, "permanent", {
        now: 1_200,
        maxAttempts: 1,
      }).state,
    ).toBe("dead_letter");
    expect(store.counts().deadLetter).toBe(1);
  });

  it("validates notification content", () => {
    expect(() =>
      store.enqueue({ producer: "codex", idempotencyKey: "bad", title: "", message: "body" }),
    ).toThrow(/title/);
  });
});

function enqueue() {
  return store.enqueue(
    {
      producer: "codex",
      idempotencyKey: "codex:run:1",
      title: "Daily report",
      message: "All checks passed.",
    },
    1_000,
  );
}
