import type { OutboundNotification } from "../core/types.js";
import { escapeRichMarkdownText, prepareRichMarkdownParts } from "./rich-markdown.js";

export function renderNotificationParts(notification: OutboundNotification): readonly string[] {
  return prepareRichMarkdownParts(
    `# 📬 ${escapeRichMarkdownText(notification.title)}\n\n${notification.message.trim()}`,
  );
}
