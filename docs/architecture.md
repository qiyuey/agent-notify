# Architecture

Codex writes to a local durable queue, and the delivery daemon sends notifications to Telegram.

```text
Codex MCP → outbound_notifications (SQLite) → delivery daemon → Telegram Bot API
```

The MCP server exposes `deliver_notification(title, message, dedupeKey?)` and sets `codex` as the
producer. Destination and credentials come from the daemon configuration.

The producer process only enqueues. The daemon is the sole network sender. It leases queued rows,
sends Rich Markdown, records the provider message ID, and retries failures with bounded exponential
backoff. Idempotency keys are scoped by producer before storage.

Telegram is the only channel adapter. Additional channels should be added only when required; the
dispatcher already depends on the small `NotificationSender` port rather than Telegram directly.

The process owns no agent task session and consumes no Telegram updates. Runtime state consists
only of the notification table, migration ledger, heartbeat file, and single-instance lock.
