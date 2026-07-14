# Contributing

Codex IM is currently in pre-alpha. Contributions that pick up items from the
[roadmap](PLAN.md), improve the threat model, or add reproducible protocol and
adapter fixtures are especially useful. `docs/architecture.md` describes how the
shipped system works.

## Before opening a change

1. Search existing issues and discussions.
2. Keep changes focused on one behavior or decision.
3. Open an issue first for protocol, persistence, security-boundary, or adapter
   API changes.
4. Never include real bot tokens, Codex credentials, prompts, transcripts, or
   private workspace paths in tests or documentation.

## Development expectations

Every change should include appropriate tests and must pass `pnpm check`, which
covers formatting, linting, type checking, tests with coverage thresholds, the
bundle build, and plugin validation.

Use Conventional Commits for commit messages, for example:

```text
feat(delivery): add durable Telegram retry
fix(delivery): recover expired event leases
docs(security): document Telegram token rotation
```

## Pull requests

- Explain the user-visible behavior and failure behavior.
- Identify any trust-boundary or data-migration impact.
- Include verification steps.
- Update `docs/architecture.md` or an ADR when a design decision changes, and
  `PLAN.md` when roadmap scope changes.
- Keep credential-dependent end-to-end tests opt-in.

By contributing, you agree that your contribution is licensed under the MIT
License.
