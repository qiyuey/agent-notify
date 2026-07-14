# Security Policy

Security fixes target the latest development branch until a stable-version policy is published.

Report vulnerabilities privately to `1123274330@qq.com`. Include the affected revision,
reproduction steps, and impact without real secrets or private user data.

Codex IM is an outbound-only Telegram delivery service. Protect the bot token, target chat,
local environment file, and SQLite queue. The MCP tool cannot override the configured destination,
and the daemon does not accept Telegram updates or connect to Codex task sessions.
