# Architecture

Agent Notify has multiple local producers, one durable queue, and one network consumer.

```text
Codex MCP ─┐
           ├── EnqueueNotification ── outbound_notifications (SQLite)
Pi tool ───┘                              └── DeliveryApplication
                                                   └── Telegram Bot API
```

Both integrations expose `deliver_notification(title, message, dedupeKey?)`. They assign their own
trusted producer identity; the model cannot select a destination or provide transport credentials.

The producer process only enqueues. The daemon is the sole network sender. It leases queued rows,
sends Rich Markdown, records the provider message ID, and retries failures with bounded exponential
backoff. Idempotency keys are scoped by producer before storage.

Telegram is the only channel adapter. Additional channels should be added only when required; the
dispatcher already depends on the small `NotificationSender` port rather than Telegram directly.

The process owns no agent task session and consumes no Telegram updates. Runtime state consists
only of the notification table, migration ledger, heartbeat file, and single-instance lock.
