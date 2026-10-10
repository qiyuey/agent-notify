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

## Build and installation boundaries

`npm run build` creates three separate packages:

| Package | Contents | Installation target |
| --- | --- | --- |
| `artifacts/agent-notify` | Codex manifest, MCP configuration, bundled MCP server, notification skill | Codex plugin marketplace source |
| `artifacts/pi-package` | Pi package metadata, bundled extension, notification skill | Pi package installation |
| `artifacts/runtime` | CLI, daemon, environment example | Local delivery service |

The Codex plugin does not install or start the daemon. Verify installed plugin files against the
Codex package, the installed Pi files against the Pi package, and the running service against the
runtime package. `npm run validate:plugin` checks package boundaries and byte-for-byte equality
with the build inputs; `npm run test:mcp` verifies the packaged MCP protocol using isolated state.

A successful tool call reports enqueue status, not necessarily Telegram delivery. `queued` and
`leased` are pending, `delivered` confirms delivery, and `dead_letter` requires investigation and
recovery. Reusing a dedupe key returns the existing notification and its current state. After a
lost response, only retry with the original key and payload; a request without a key can create a
second notification.
