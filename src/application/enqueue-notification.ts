import { randomUUID } from "node:crypto";
import { openNotificationStore } from "../storage/open-store.js";

export interface DeliverNotificationInput {
  readonly title: string;
  readonly message: string;
  readonly dedupeKey?: string;
}

export interface EnqueueNotificationResult {
  readonly notificationId: string;
  readonly state: string;
  readonly duplicate: boolean;
}

export function enqueueNotification(
  producer: string,
  input: DeliverNotificationInput,
  env: NodeJS.ProcessEnv = process.env,
): EnqueueNotificationResult {
  const context = openNotificationStore(env);
  try {
    const idempotencyKey = `${producer}:${input.dedupeKey ?? randomUUID()}`;
    const duplicate = context.store.findByIdempotencyKey(idempotencyKey) !== null;
    const notification = context.store.enqueue({
      producer,
      idempotencyKey,
      title: input.title,
      message: input.message,
    });
    return { notificationId: notification.id, state: notification.state, duplicate };
  } finally {
    context.database.close();
  }
}
