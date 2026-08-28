import type { EnqueueNotificationInput } from "./types.js";

export function validateNotificationInput(input: EnqueueNotificationInput): void {
  assertNonEmpty(input.producer, "producer", 64);
  assertNonEmpty(input.idempotencyKey, "idempotencyKey", 512);
  assertNonEmpty(input.title, "title", 200);
  assertNonEmpty(input.message, "message", 12_000);
}

function assertNonEmpty(value: string, name: string, maxLength: number): void {
  if (value.length === 0 || value.length > maxLength || value.includes("\0")) {
    throw new Error(`${name} must contain 1-${maxLength} safe characters`);
  }
}
