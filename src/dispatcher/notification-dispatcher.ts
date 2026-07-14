import { describeError, type Logger, silentLogger } from "../core/logger.js";
import type { OutboundNotification } from "../core/types.js";
import type { OutboundNotificationStore } from "../storage/notification-store.js";

export interface NotificationSender {
  send(notification: OutboundNotification): Promise<{ readonly messageId: string }>;
}

export class NotificationDispatcher {
  constructor(
    private readonly notifications: OutboundNotificationStore,
    private readonly sender: NotificationSender,
    private readonly logger: Logger = silentLogger,
  ) {}

  async runOnce(now = Date.now()): Promise<boolean> {
    const notification = this.notifications.leaseNext({ now, leaseDurationMs: 60_000 });
    if (!notification?.leaseToken) return false;
    try {
      const sent = await this.sender.send(notification);
      this.notifications.markDelivered(
        notification.id,
        notification.leaseToken,
        sent.messageId,
        now,
      );
    } catch (error) {
      const described = describeError(error);
      this.notifications.markFailed(notification.id, notification.leaseToken, described.message, {
        now,
      });
      this.logger.warn("telegram_delivery_failed", {
        notificationId: notification.id,
        kind: described.kind,
        message: described.message,
      });
    }
    return true;
  }
}
