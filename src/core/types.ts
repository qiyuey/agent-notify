export const notificationStates = ["queued", "leased", "delivered", "dead_letter"] as const;
export type NotificationState = (typeof notificationStates)[number];

export interface EnqueueNotificationInput {
  readonly producer: string;
  readonly idempotencyKey: string;
  readonly title: string;
  readonly message: string;
}

export interface OutboundNotification extends EnqueueNotificationInput {
  readonly id: string;
  readonly state: NotificationState;
  readonly attemptCount: number;
  readonly nextAttemptAt: number;
  readonly leaseExpiresAt: number | null;
  readonly leaseToken: string | null;
  readonly providerMessageId: string | null;
  readonly lastError: string | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface NotificationCounts {
  readonly queued: number;
  readonly leased: number;
  readonly delivered: number;
  readonly deadLetter: number;
}
