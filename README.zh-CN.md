# Agent Notify

Agent Notify 将明确要求投递的 Codex 任务结果可靠地发送到 Telegram。

```text
Codex MCP → deliver_notification → SQLite 队列 → daemon 重试 → Telegram
```

Agent Notify 只负责通知：不接收 Telegram 消息、不管理 Agent 会话，也不自动发送任务完成卡片。

## 运行服务

要求 Node.js 26+、npm 12+、Telegram Bot Token 和目标 Chat ID。
使用 `package.json` 的 `packageManager` 字段固定的 npm 版本，与 CI 保持一致。

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
`./artifacts/agent-notify`，安装该条目并开启新对话。插件使用 Agent Plugins 1.0 的
`plugin.json` 和 `mcp.json` 格式，通过 stdio 在桌面端本地线程或 Codex CLI 会话中启动 MCP
服务。ChatGPT 网页、移动端和云端线程无法运行该本地服务。公开发布含本地 MCP 服务的
[桌面插件](https://developers.openai.com/plugins/deploy/desktop-only)需要 OpenAI 合作伙伴审批。
本机的 `PATH` 需包含 Node.js。投递 daemon 需按上面的运行服务步骤单独安装和启动。

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
