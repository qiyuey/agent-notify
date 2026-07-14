import { describe, expect, it, vi } from "vitest";
import type { OutboundNotification } from "../src/core/types.js";
import { TelegramNotificationSender } from "../src/telegram/notification-sender.js";

const notification: OutboundNotification = {
  id: "notification-1",
  idempotencyKey: "run:1",
  title: "Scheduled report",
  message: "## Result\n\n- Passed",
  state: "queued",
  attemptCount: 0,
  nextAttemptAt: 0,
  leaseExpiresAt: null,
  leaseToken: null,
  telegramMessageId: null,
  lastError: null,
  createdAt: 0,
  updatedAt: 0,
};

describe("TelegramNotificationSender", () => {
  it("sends Rich Markdown without conversation actions", async () => {
    const sendRichMessage = vi.fn(async (_chatId: number, _markdown: string) => ({
      messageId: "message-1",
    }));
    const sender = new TelegramNotificationSender({ sendRichMessage }, 42);
    await expect(sender.send(notification)).resolves.toEqual({ messageId: "message-1" });
    expect(sendRichMessage).toHaveBeenCalledWith(
      42,
      expect.stringContaining("# 📬 Scheduled report"),
    );
    expect(sendRichMessage.mock.calls[0]?.[1]).toContain("## Result");
  });

  it("splits oversized Rich Markdown into sequential messages", async () => {
    const sendRichMessage = vi.fn(async (_chatId: number, _markdown: string) => ({
      messageId: "message-1",
    }));
    const sender = new TelegramNotificationSender({ sendRichMessage }, 42);
    await sender.send({ ...notification, message: "x".repeat(70_000) });
    expect(sendRichMessage).toHaveBeenCalledTimes(3);
    expect(sendRichMessage.mock.calls.every((call) => call[1].length <= 32_768)).toBe(true);
  });
});
