# Threat model

Protected assets are the Telegram bot token, target chat ID, queued message content, and delivery
history.

- The bot token is read only from local environment configuration and is redacted from errors.
- Only the configured target chat can receive messages.
- The MCP tool accepts bounded title and message strings and never accepts a destination override.
- SQLite files and runtime state are created with owner-only permissions.
- The daemon is the only network sender; enqueue calls do not contact Telegram.
- Idempotency keys and leases limit duplicate sends during retries and restarts.

Codex IM intentionally has no inbound Telegram surface and no access to Codex task sessions,
workspaces, files, approvals, or conversation state.
