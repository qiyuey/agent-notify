import { randomUUID } from "node:crypto";
import { redactSecrets } from "../core/logger.js";
import type {
  EnqueueNotificationInput,
  NotificationCounts,
  NotificationState,
  OutboundNotification,
} from "../core/types.js";
import { validateNotificationInput } from "../core/validation.js";
import type { NotificationDatabase } from "./database.js";

interface NotificationRow {
  id: string;
  producer: string;
  idempotency_key: string;
  title: string;
  message: string;
  state: NotificationState;
  attempt_count: number;
  next_attempt_at: number;
  lease_expires_at: number | null;
  lease_token: string | null;
  provider_message_id: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export interface LeaseOptions {
  readonly now?: number;
  readonly leaseDurationMs?: number;
}

export interface RetryOptions {
  readonly now?: number;
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly random?: () => number;
}

export class OutboundNotificationStore {
  constructor(private readonly database: NotificationDatabase) {}

  enqueue(input: EnqueueNotificationInput, now = Date.now()): OutboundNotification {
    validateNotificationInput(input);
    const id = randomUUID();
    this.database.connection
      .prepare(`
        INSERT INTO outbound_notifications (
          id, producer, idempotency_key, title, message, state, next_attempt_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?)
        ON CONFLICT(idempotency_key) DO NOTHING
      `)
      .run(id, input.producer, input.idempotencyKey, input.title, input.message, now, now, now);
    return (
      this.findByIdempotencyKey(input.idempotencyKey) ?? fail("Failed to enqueue notification")
    );
  }

  findByIdempotencyKey(idempotencyKey: string): OutboundNotification | null {
    const row = this.database.connection
      .prepare("SELECT * FROM outbound_notifications WHERE idempotency_key = ?")
      .get(idempotencyKey) as NotificationRow | undefined;
    return row ? mapNotification(row) : null;
  }

  list(state?: NotificationState, limit = 20): readonly OutboundNotification[] {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const rows = state
      ? (this.database.connection
          .prepare(
            "SELECT * FROM outbound_notifications WHERE state = ? ORDER BY created_at DESC LIMIT ?",
          )
          .all(state, boundedLimit) as unknown as NotificationRow[])
      : (this.database.connection
          .prepare("SELECT * FROM outbound_notifications ORDER BY created_at DESC LIMIT ?")
          .all(boundedLimit) as unknown as NotificationRow[]);
    return rows.map(mapNotification);
  }

  leaseNext(options: LeaseOptions = {}): OutboundNotification | null {
    const now = options.now ?? Date.now();
    const leaseDurationMs = options.leaseDurationMs ?? 30_000;
    if (leaseDurationMs <= 0) throw new Error("leaseDurationMs must be positive");
    return this.database.transaction(() => {
      this.recoverExpired(now);
      const row = this.database.connection
        .prepare(`
          SELECT id FROM outbound_notifications
          WHERE state = 'queued' AND next_attempt_at <= ?
          ORDER BY next_attempt_at, created_at
          LIMIT 1
        `)
        .get(now) as { id: string } | undefined;
      if (!row) return null;
      const leaseToken = randomUUID();
      this.database.connection
        .prepare(`
          UPDATE outbound_notifications
          SET state = 'leased', attempt_count = attempt_count + 1,
              lease_expires_at = ?, lease_token = ?, updated_at = ?
          WHERE id = ? AND state = 'queued'
        `)
        .run(now + leaseDurationMs, leaseToken, now, row.id);
      return this.getRequired(row.id);
    });
  }

  markDelivered(
    id: string,
    leaseToken: string,
    providerMessageId: string,
    now = Date.now(),
  ): OutboundNotification {
    const result = this.database.connection
      .prepare(`
        UPDATE outbound_notifications
        SET state = 'delivered', lease_expires_at = NULL, lease_token = NULL,
            provider_message_id = ?, last_error = NULL, updated_at = ?
        WHERE id = ? AND state = 'leased' AND lease_token = ?
      `)
      .run(providerMessageId, now, id, leaseToken);
    if (result.changes !== 1) throw new Error("Notification lease is missing or stale");
    return this.getRequired(id);
  }

  markFailed(
    id: string,
    leaseToken: string,
    errorMessage: string,
    options: RetryOptions = {},
  ): OutboundNotification {
    const now = options.now ?? Date.now();
    const notification = this.getRequired(id);
    if (notification.state !== "leased" || notification.leaseToken !== leaseToken) {
      throw new Error("Notification lease is missing or stale");
    }
    const deadLetter = notification.attemptCount >= (options.maxAttempts ?? 8);
    const nextAttemptAt = now + retryDelayMs(notification.attemptCount, options);
    const result = this.database.connection
      .prepare(`
        UPDATE outbound_notifications
        SET state = ?, next_attempt_at = ?, lease_expires_at = NULL, lease_token = NULL,
            last_error = ?, updated_at = ?
        WHERE id = ? AND state = 'leased' AND lease_token = ?
      `)
      .run(
        deadLetter ? "dead_letter" : "queued",
        nextAttemptAt,
        redactSecrets(errorMessage).slice(0, 1_000),
        now,
        id,
        leaseToken,
      );
    if (result.changes !== 1) throw new Error("Notification lease is missing or stale");
    return this.getRequired(id);
  }

  recoverExpired(now = Date.now()): number {
    const result = this.database.connection
      .prepare(`
        UPDATE outbound_notifications
        SET state = 'queued', lease_expires_at = NULL, lease_token = NULL,
            next_attempt_at = ?, updated_at = ?
        WHERE state = 'leased' AND lease_expires_at <= ?
      `)
      .run(now, now, now);
    return Number(result.changes);
  }

  counts(): NotificationCounts {
    const rows = this.database.connection
      .prepare("SELECT state, COUNT(*) AS count FROM outbound_notifications GROUP BY state")
      .all() as Array<{ state: NotificationState; count: number }>;
    const counts = { queued: 0, leased: 0, delivered: 0, deadLetter: 0 };
    for (const row of rows) {
      if (row.state === "dead_letter") counts.deadLetter = row.count;
      else counts[row.state] = row.count;
    }
    return counts;
  }

  private getRequired(id: string): OutboundNotification {
    const row = this.database.connection
      .prepare("SELECT * FROM outbound_notifications WHERE id = ?")
      .get(id) as NotificationRow | undefined;
    return row ? mapNotification(row) : fail(`Unknown notification: ${id}`);
  }
}

function retryDelayMs(attempt: number, options: RetryOptions): number {
  const base = options.baseDelayMs ?? 1_000;
  const ceiling = Math.min(base * 2 ** Math.max(0, attempt - 1), 15 * 60_000);
  return Math.round(ceiling * (0.5 + 0.5 * (options.random ?? Math.random)()));
}

function mapNotification(row: NotificationRow): OutboundNotification {
  return {
    id: row.id,
    producer: row.producer,
    idempotencyKey: row.idempotency_key,
    title: row.title,
    message: row.message,
    state: row.state,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    leaseExpiresAt: row.lease_expires_at,
    leaseToken: row.lease_token,
    providerMessageId: row.provider_message_id,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fail(message: string): never {
  throw new Error(message);
}
