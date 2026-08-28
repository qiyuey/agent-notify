# Agent Notify

Agent Notify durably delivers explicitly requested coding-agent results to IM. It currently
supports Codex and Pi as producers and Telegram as the delivery channel.

```text
Codex MCP ─┐
           ├─ deliver_notification → SQLite queue → daemon retries → Telegram
Pi tool ───┘
```

Agent Notify is notification-only. It does not receive Telegram messages, manage agent sessions,
or send automatic completion cards.

## Runtime

Requires Node.js 26+, pnpm 11+, a Telegram bot token, and a target chat ID.

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
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

Pi can install the repository directly:

```bash
pi install git:github.com/qiyuey/agent-notify
```

The Pi package registers the same tool and skill. Both integrations use producer-scoped
idempotency keys and the same local queue.

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
pnpm check
```
