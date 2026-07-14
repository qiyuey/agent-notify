---
name: release
description: "Publish Codex IM's delivery-only plugin and daemon with exact-SHA local application, migration, real Telegram delivery, and matching GitHub Actions verification. Use only when the user explicitly asks to release, publish, ship, or deploy; this workflow pushes Git history, reinstalls the plugin, restarts launchd, migrates local state, and sends one Telegram acceptance message."
---

# Release Codex IM

Treat the pushed commit SHA and manifest version as the release identity. A release succeeds only
when the exact plugin cache, restarted daemon, delivery-only database, real Telegram delivery, and
matching remote CI all pass.

## Guard the release

1. Confirm the repository root, branch, `origin`, upstream, GitHub authentication, and absence of
   merge/rebase state.
2. Review every tracked and untracked change. Never include `.env`, credentials, transcripts, or
   private data.
3. Fetch `origin` and synchronize before changing the manifest. Rewrite published history only
   when the user explicitly authorizes it; use `--force-with-lease`, never unguarded force.
4. When the user requests a single-commit history, verify the intended target branch, build one
   root commit from the reviewed tree, and prove `git rev-list --count HEAD == 1` before pushing.

## Build the release

1. Run `node .agents/skills/release/scripts/update-cachebuster.mjs .`.
2. Match the Node and pnpm versions declared in `.github/workflows/ci.yml`.
3. Run `pnpm install --frozen-lockfile && pnpm check`.
4. Require clean `git diff --check`, review the complete staged patch, and create one Conventional
   Commit without bypassing hooks.
5. Push the current branch normally, or with `--force-with-lease` only under the explicit
   authorization above. Require the remote ref to equal the captured release SHA.

## Apply the exact local build

1. From filtered `codex plugin list --available --json` and
   `codex plugin marketplace list --json`, require exactly one local marketplace source whose
   real path is this checkout.
2. Reinstall `codex-im@<marketplace>`. Require the installed version to equal the manifest and
   compare SHA-256 hashes for:
   - `.codex-plugin/plugin.json`
   - `dist/daemon.js`
   - `dist/cli.js`
   - `dist/mcp/server.js`
   - `skills/telegram-delivery/SKILL.md`
3. Require the installed cache to contain no hooks, gateway skill, or app-server/thread runtime.
4. Verify launchd target `gui/$(id -u)/com.qiyuey.codex-im` invokes this checkout's
   `dist/daemon.js`. Capture its PID, kickstart that exact target, and require a new running PID,
   exit code 0, and `node dist/cli.js health | jq -e '.status == "ok"'`.
5. From the health-reported database, require:
   - migration `10:delivery_only`;
   - only `schema_migrations` and `outbound_notifications` tables;
   - the expected notification indexes;
   - `PRAGMA integrity_check == ok`;
   - no app-server child process owned by the daemon.

## Verify real delivery

After restart, invoke the released `dist/mcp/server.js` through MCP with a unique
`telegram_deliver` dedupe key and a concise release-acceptance message. Do not write directly to
SQLite and do not use legacy completion producers. Poll the notification row until it is
`delivered`; require a non-empty Telegram message ID and no error. This intentionally sends one
Telegram message.

## Verify remote CI

Find the workflow run by exact pushed SHA:

```bash
gh run list --workflow ci.yml --commit "$release_sha" \
  --json databaseId,status,conclusion,url,headSha,event --limit 10
```

Wait for the matching run and require `gh run watch <id> --compact --exit-status` to succeed. On
failure, report the failed job without creating another commit unless the user requests a fix.

## Report

Report the branch, single-commit count when requested, SHA, subject, remote, manifest version,
installed cache root and hash result, absence of legacy surfaces, old/new daemon PID, migration and
integrity result, real Telegram delivery ID, and matching CI URL/conclusion. Tell the user to start
a new Codex task to load the refreshed plugin bundle.
