# Contributing

Read [development](docs/development.md), [PRD](docs/PRD.md), and [architecture](docs/architecture/README.md). Branch from main, preserve history, and open a PR describing behavior, tests and remaining limitations.

Use Conventional Commits (`feat(registry): add zone lookup`). Run `npm run hooks:install` for optional formatting/link/commit checks. CI is authoritative. Use Prettier for supported web/docs/config files, Ruff for Python, and Java 21 formatting conventions with four spaces. Keep domain logic independent of controllers and infrastructure.

Run lint, typecheck, web tests/build, Playwright, Maven verify, AI pytest/Ruff, contract tests, repository integrity, and relevant Compose smoke checks. Label synthetic data. Never submit secrets, private city records or unlicensed datasets. License selection remains pending an explicit owner decision.
