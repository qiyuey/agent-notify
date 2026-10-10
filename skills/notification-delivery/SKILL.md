---
name: notification-delivery
description: Deliver one completed agent task result through the configured IM channel. Use only when the user or a scheduled task explicitly requests notification delivery, especially as the final step of an unattended task.
---

# Notification Delivery

Use `deliver_notification` after completing an explicitly opted-in task. Delivery currently uses
Telegram. Explicit user instructions take precedence over this workflow, including a later request
to cancel delivery. A task that does not request notification delivery does not opt in.

1. Finish the requested work and its required verification before preparing the notification.
2. Compose a concise, self-contained result:
   - `title`: identify the task or report.
   - `message`: state success, failure, or partial completion; include the important result,
     relevant artifact paths or links, and any action the user must take. Write GFM-compatible Rich
     Markdown; do not generate Telegram HTML or MarkdownV2 and do not escape Markdown punctuation.
3. Queue one notification per logical task result. Do not call it for tasks that merely inspect delivery
   health or mention Telegram without requesting delivery.
4. If the workflow provides a stable run identifier, pass it as `dedupeKey`. Otherwise omit it.
   After a timeout or lost response, retry at most once, only with the same key and unchanged payload.
   Without a key, report the uncertain outcome instead of risking a duplicate. Do not retry a
   successful enqueue or an invalid request unchanged.
5. Give the task outcome in the normal final response and report the returned delivery state:
   `queued` or `leased` means delivery is pending; only `delivered` confirms delivery.
   `dead_letter` means delivery exhausted its retries and needs recovery. A duplicate response
   refers to the existing notification, not a new send. The daemon handles network retries.

If the task fails before producing its intended artifact, still deliver one failure summary when
the task contract requires delivery. Never claim delivery succeeded when the tool call failed.
