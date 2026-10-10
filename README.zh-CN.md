# Agent Notify

Agent Notify 将明确要求投递的编码 Agent 结果可靠地发送到 IM。目前支持 Codex 和 Pi
作为生产端，Telegram 作为投递渠道。

```text
Codex MCP ─┐
           ├─ deliver_notification → SQLite 队列 → daemon 重试 → Telegram
Pi 工具 ───┘
```

Agent Notify 只负责通知：不接收 Telegram 消息、不管理 Agent 会话，也不自动发送任务完成卡片。

## 运行服务

要求 Node.js 26+、npm 11+、Telegram Bot Token 和目标 Chat ID。

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

daemon 独占 Telegram 网络发送；Agent 工具只负责入队，因此 Telegram 短暂故障不会阻塞工具调用。

## Agent 集成

Codex 插件提供 `notification-delivery` skill 和 `deliver_notification` MCP 工具。
运行 `npm run build` 后，将本地 Codex marketplace 条目的来源指向相对于仓库根目录的
`./artifacts/agent-notify`，安装该条目并开启新对话。插件要求 `PATH` 中有 Node.js；
投递 daemon 需按上面的运行服务步骤单独安装和启动。

Pi 可直接从 Git 仓库安装：

```bash
pi install git:github.com/qiyuey/agent-notify
```

Pi package 注册相同的工具和 skill。两个生产端共享本地队列，并使用按生产端隔离的幂等键。

## 运维

```bash
node dist/cli.js health
node dist/cli.js doctor
node dist/cli.js notifications --state queued
node dist/cli.js notifications --state dead_letter
node dist/cli.js recover
node dist/cli.js service status
```

队列提供幂等、租约、指数退避重试和死信状态。`dedupeKey` 仅标识某个生产端的一次逻辑投递，
只能在重试同一次投递时复用。

为平滑迁移，程序仍会识别旧 `CODEX_IM_*` 配置和
`~/.local/share/codex-im/gateway.sqlite` 数据库。

开发校验：

```bash
npm run check
```

该命令包含对独立打包的 Codex 插件进行的真实 MCP 协议测试，使用临时数据库，不发送 Telegram
消息。构建后可用 `npm run test:mcp` 单独重跑，覆盖握手、工具发现、持久化去重和错误恢复。
