# Agent Notify

Agent Notify durably delivers explicitly requested Codex results to Telegram.

```text
Codex MCP → deliver_notification → SQLite queue → daemon retries → Telegram
```

Agent Notify is notification-only. It does not receive Telegram messages, manage agent sessions,
or send automatic completion cards.

## Runtime

Requires Node.js 26+, npm 12+, a Telegram bot token, and a target chat ID.
Use the npm version pinned in `package.json` (`packageManager`) to match CI.

```bash
npm ci
cp .env.example .env
npm run build
node dist/cli.js service install
```

```dotenv
TELEGRAM_BOT_TOKEN=replace-with-local-secret
TELEGRAM_ALLOWED_CHAT_ID=123456789
AGENT_NOTIFY_DISPATCH_INTERVAL_MS=1000
```

The daemon owns all Telegram network delivery. Producers only enqueue notifications, so transient
Telegram failures do not block the agent tool call.

## Agent integrations

The Codex plugin exposes the `notification-delivery` skill and `deliver_notification` MCP tool.
After `npm run build`, point your local Codex marketplace entry at
`./artifacts/agent-notify` relative to this repository's marketplace root. Install that entry in
Codex and start a new chat to load it. The package uses the Agent Plugins 1.0 `plugin.json` and
`mcp.json` format. It runs its stdio MCP server in local desktop threads and Codex CLI sessions.
ChatGPT web, mobile, and cloud threads cannot run the local server. Public distribution of
[desktop-only plugins with local MCP servers](https://developers.openai.com/plugins/deploy/desktop-only)
requires OpenAI partner approval. The host needs Node.js on `PATH`. Install and start the delivery
daemon separately using the Runtime steps above.

## Operations

```bash
node dist/cli.js health
node dist/cli.js doctor
node dist/cli.js notifications --state queued
node dist/cli.js notifications --state dead_letter
node dist/cli.js recover
node dist/cli.js service status
```

The queue provides idempotency, leases, exponential retry, and dead-letter handling. A
`dedupeKey` identifies one logical delivery for one producer and must only be reused when retrying
that delivery.

Legacy `CODEX_IM_*` configuration and the existing `~/.local/share/codex-im/gateway.sqlite`
database are discovered for migration compatibility.

Development verification:

```bash
npm run check
```

This includes real MCP protocol tests against a relocated copy of the built Codex plugin, using
temporary databases and no Telegram delivery. To rerun just those tests after building, use
`npm run test:mcp`.
