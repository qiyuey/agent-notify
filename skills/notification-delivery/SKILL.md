---
name: notification-delivery
description: Deliver one completed agent task result through the configured IM channel. Use only when the user or a scheduled task explicitly requests notification delivery, especially as the final step of an unattended task.
---

# Notification Delivery

Use `deliver_notification` as the final action of an explicitly opted-in task. Delivery currently
uses Telegram. Do not send automatic completion notifications.

1. Finish the requested work and its required verification before preparing the notification.
2. Compose a concise, self-contained result:
   - `title`: identify the task or report.
   - `message`: state success, failure, or partial completion; include the important result,
     relevant artifact paths or links, and any action the user must take. Write GFM-compatible Rich
     Markdown; do not generate Telegram HTML or MarkdownV2 and do not escape Markdown punctuation.
3. Call `deliver_notification` exactly once. Do not call it for tasks that merely inspect delivery
   health or mention Telegram without requesting delivery.
4. If the workflow provides a stable run identifier, pass it as `dedupeKey`. Reuse the same key
   only when retrying the same logical run. Otherwise omit it and do not retry after a successful
   enqueue response.
5. Give the same outcome in the normal final response and state whether notification delivery was
   queued. A queued response is success; network delivery is handled asynchronously by the daemon.

If the task fails before producing its intended artifact, still deliver one failure summary when
the task contract requires delivery. Never claim delivery succeeded when the tool call failed.
