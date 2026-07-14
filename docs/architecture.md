# Architecture

Codex IM has one producer, one queue, and one consumer.

```text
Codex MCP host
  └── telegram_deliver(title, message, dedupeKey?)
        └── outbound_notifications (SQLite)
              └── DeliveryApplication
                    └── Telegram Bot API
```

The MCP tool only enqueues. The daemon is the sole network sender. It leases queued rows, sends
Rich Markdown, records the Telegram message ID, and retries failures with bounded exponential
backoff. A stable `dedupeKey` makes enqueue idempotent.

The process owns no Codex task session and consumes no Telegram updates. Runtime state consists
only of the notification table, migration ledger, heartbeat file, and single-instance lock.

Schema migration 10 preserves existing outbound notification rows and removes every legacy
conversation, completion, binding, mute, status-card, and watch table.
