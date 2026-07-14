# Codex IM

Codex IM 只做一件事：把用户或任务契约明确要求的消息，可靠地投递到 Telegram。

## 数据流

```text
telegram_deliver MCP 工具 → SQLite 队列 → daemon 重试循环 → Telegram
```

项目不再接收 Telegram 消息，不连接 Codex app-server，不自动发送任务完成卡片，也没有任务
选择、回复路由、thread watch 或 Stop Hook。

## 配置

要求 Node.js 26+、pnpm 11+、Telegram Bot Token 和目标 Chat ID。

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm build
node dist/cli.js service install
```

`.env`：

```dotenv
TELEGRAM_BOT_TOKEN=replace-with-local-secret
TELEGRAM_ALLOWED_CHAT_ID=123456789
CODEX_IM_DISPATCH_INTERVAL_MS=1000
```

安装个人插件后，仅在用户或任务契约明确要求 Telegram 投递时使用内置
`telegram-delivery` skill。

## 运维

```bash
node dist/cli.js health
node dist/cli.js doctor
node dist/cli.js notifications --state queued
node dist/cli.js notifications --state dead_letter
node dist/cli.js recover
node dist/cli.js service status
```

SQLite 队列提供幂等、租约、指数退避重试和死信状态。`dedupeKey` 只标识一次逻辑投递，
只能在重试同一次投递时复用。

开发校验：

```bash
pnpm check
```
