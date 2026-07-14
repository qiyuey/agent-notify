# Codex IM

Codex IM does one thing: it durably delivers explicitly requested messages to Telegram.

## Flow

```text
telegram_deliver MCP tool → SQLite queue → daemon retry loop → Telegram
```

There is no inbound Telegram polling, Codex app-server connection, automatic task-completion
delivery, task selection, reply routing, thread watch, or Stop Hook.

## Setup

Requirements: Node.js 26+, pnpm 11+, a Telegram bot token, and a target chat ID.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
node dist/cli.js service install
```

`.env`:

```dotenv
TELEGRAM_BOT_TOKEN=replace-with-local-secret
TELEGRAM_ALLOWED_CHAT_ID=123456789
CODEX_IM_DISPATCH_INTERVAL_MS=1000
```

Install the personal plugin, then invoke the bundled `telegram-delivery` skill only when the user
or task contract explicitly requests Telegram delivery.

## Operations

```bash
node dist/cli.js health
node dist/cli.js doctor
node dist/cli.js notifications --state queued
node dist/cli.js notifications --state dead_letter
node dist/cli.js recover
node dist/cli.js service status
```

The SQLite queue provides idempotency, leases, exponential retry, and dead-letter handling.
`dedupeKey` identifies one logical delivery and must only be reused for a retry of that delivery.

## Development

```bash
pnpm check
```

See [architecture](docs/architecture.md), [operations](docs/operations.md), and the
[threat model](docs/threat-model.md).
