import type { OutboundNotification } from "../core/types.js";
import type { NotificationSender } from "../dispatcher/notification-dispatcher.js";
import { renderNotificationParts } from "./render.js";
import type { TelegramApi } from "./types.js";

export class TelegramNotificationSender implements NotificationSender {
  constructor(
    private readonly api: TelegramApi,
    private readonly chatId: number,
  ) {}

  async send(notification: OutboundNotification): Promise<{ readonly messageId: string }> {
    const parts = renderNotificationParts(notification);
    const first = parts[0];
    if (!first) throw new Error("Notification must contain at least one part");
    const sent = await this.api.sendRichMessage(this.chatId, first);
    for (const part of parts.slice(1)) await this.api.sendRichMessage(this.chatId, part);
    return sent;
  }
}
