# Development

Prerequisites: Node 22.14+ or 24, npm 10+, Java 21+, Maven 3.9+, Python 3.11–3.14, Git, Docker Desktop with Linux containers and Compose v2. Initial dependency downloads require internet. No paid cloud service is needed.

## Compose quick start

```sh
npm ci
python scripts/setup-env.py
npm run hooks:install
docker compose up --build -d --wait
python scripts/smoke.py
```

Open http://localhost:3000. Health: web `/api/health`; API `:8080/actuator/health/readiness`; AI `:8000/health`. Logs: `docker compose logs -f`. Stop with `docker compose down`; data persists. `docker compose down --volumes` permanently deletes local data and is only for an intentional reset.

Local credentials are generated into ignored `.env`. Compose enables the local token profile explicitly. Never expose this stack publicly. Provision PostGIS separately and reduce database privileges for deployment.

## Host development

```sh
docker compose up -d db redis
mvn -f services/api/pom.xml spring-boot:run -Dspring-boot.run.profiles=local
python -m venv services/ai-engine/.venv
# Activate the virtual environment for your shell:
pip install -e 'services/ai-engine[dev]'
uvicorn citypulse_ai.main:app --app-dir services/ai-engine --reload
npm run dev
```

Export `.env` values into the Java/AI shells without printing secrets. Next.js reads `apps/web/.env.local`: set `API_BASE_URL=http://localhost:8080`, `AI_BASE_URL=http://localhost:8000`, and the matching `LOCAL_API_TOKEN`. Compose sets internal addresses. Maven and uvicorn do not automatically read root `.env`.

## Checks

```sh
npm run lint
npm run typecheck
npm test --workspace apps/web
npm run build
npx playwright install chromium
npm run test:e2e --workspace apps/web
npm run test:contracts
mvn -f services/api/pom.xml verify
python -m pytest services/ai-engine/tests
ruff check services/ai-engine
npm run format:check
python scripts/check_repository.py
docker compose config --quiet
```

Activate the AI virtual environment for pytest/Ruff. Java compiles to release 21. Testcontainers tests skip when Docker is absent; CI has Docker and must run them.

## Local blockchain

Run `npm run node --workspace blockchain`, then `npm run deploy:local --workspace blockchain` in another terminal. Never reuse development keys on public networks. The browser only computes digests.

## Troubleshooting

Start Docker Desktop in Linux-container mode if the engine pipe is missing. Inspect `docker compose logs api db redis` for readiness failures. Changing `.env` does not change an existing database user's password; update the role or intentionally reset disposable volumes. Verify API URL/token if registry status is offline. Map tiles need internet; tables stay usable. Start AI to use the optional baseline request.

## Forecast training and model registry

With the AI virtual environment active, run `python scripts/train_models.py` to reproduce eight synthetic segment comparisons and build `.models`. Start the AI service from the repository root so its default registry path resolves there, or set MODEL_REGISTRY_DIR to an absolute directory. Docker builds the synthetic registry into its image. Job persistence uses AI_STORAGE_DIR (a Compose volume). See [model card](model-card.md) for evaluation, intervals, rollback and scheduled benchmark support.

## Blockchain demonstration

See [local-chain guide](blockchain.md) for role-controlled contracts, `demo:local`, `demo:ephemeral`, independent report verification, key boundaries and optional testnet configuration. No public deployment is performed automatically.

The local Flyway profile permits out-of-order migrations because its synthetic fixture has reserved version 9000. This lets subsequent schema versions apply to existing development volumes. The non-local profile uses only schema migrations and keeps Flyway default ordering. Never edit an applied migration to change fixtures; add a new migration.
