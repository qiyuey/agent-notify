# Operations

The daemon requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_CHAT_ID`. Optional
`AGENT_NOTIFY_DISPATCH_INTERVAL_MS` defaults to 1000 ms. Private runtime data defaults to
`~/.local/share/agent-notify` and can be relocated with `AGENT_NOTIFY_DATA_DIR`. Existing
`CODEX_IM_*` settings and the legacy data directory remain readable during migration.

Use `agent-notify health` for heartbeat and queue counts, `notifications` to inspect metadata, and
`recover` to release expired leases. A delivered row records its Telegram message ID; a
dead-letter row keeps its redacted last error for diagnosis.

Back up `notifications.sqlite` only while the daemon is stopped, or use SQLite's online backup
tooling. A migrated installation may continue using the legacy `gateway.sqlite` path.
Rotate a compromised bot token by stopping the daemon, updating the local env file, and restarting
the launchd service.
