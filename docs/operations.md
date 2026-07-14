# Operations

The daemon requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_CHAT_ID`. Optional
`CODEX_IM_DISPATCH_INTERVAL_MS` defaults to 1000 ms. Private runtime data defaults to
`~/.local/share/codex-im` and can be relocated with `CODEX_IM_DATA_DIR`.

Use `codex-im health` for heartbeat and queue counts, `notifications` to inspect metadata, and
`recover` to release expired leases. A delivered row records its Telegram message ID; a
dead-letter row keeps its redacted last error for diagnosis.

Back up `gateway.sqlite` only while the daemon is stopped, or use SQLite's online backup tooling.
Rotate a compromised bot token by stopping the daemon, updating the local env file, and restarting
the launchd service.
