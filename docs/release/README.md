# CityPulse release validation

Candidate: 0.1.0 development release, 30 October 2026. No public release tag or paid infrastructure is created by this audit. Documentation PR #24 was explicitly approved and merged; subsequent application changes require their own PR.

## Scope and architecture

Next.js is the browser workspace and authenticated server adapter. A modular Spring Boot API owns identity policy, tenant-scoped persistence, registry, analytics, verification, exports and audit. PostgreSQL/PostGIS stores geospatial and temporal records; Redis backs sessions, admission and caching. FastAPI owns bounded numerical inference, SciPy allocation and optional model selection for PulseAI. Solidity registries prove content integrity on an optional local EVM. Documents and provider text never grant authorization or execute generated SQL.

Registry/analytics/AI/scenarios/PulseAI/verification/export modules are implemented with varying UI depth; samples remain explicit. `apps/admin` and `services/reporting` are extraction boundaries; working routes/API live in web/API. `packages/ui` and `packages/shared-config` document future shared extraction, while current components/config live in the web app. `infrastructure/kubernetes` is planned. Terraform is implemented design/code with mock plans, not deployed infrastructure. Kafka/Redpanda, background queue workers and billing are not implemented.

## Reproduce

Prerequisites: Node 22.14+ (below 25), Python 3.12–3.14, Java 21+, Maven, Docker with a working Linux engine. Use `npm ci`, never an unconstrained install; Python runtime/dev dependencies use the committed lock files. Maven versions come from the pinned Spring Boot parent and explicit artifact versions.

```sh
npm ci
python -m venv services/ai-engine/.venv
# Activate the environment using your shell's standard command.
python -m pip install -r services/ai-engine/requirements-dev.lock
python -m pip install --no-deps -e services/ai-engine
npm run lint && npm run typecheck && npm test --workspace apps/web
npm run build
mvn -B -ntp -f services/api/pom.xml verify
python -m pytest services/ai-engine/tests
python -m unittest discover -s services/ingestion/tests -v
npm run build --workspace blockchain
npm run test:contracts
npm run demo:ephemeral --workspace blockchain
python scripts/train_models.py --data data/sample/ml/daily-segments.json --out .build/release-models --report .build/release-model-evaluation.json
python scripts/dev_stack.py up --chain --observability
python scripts/release_journey.py
python scripts/dev_stack.py down --chain --observability
```

The setup command creates random development secrets only when `.env` does not already exist. Keep it ignored. Default browser URL is `http://localhost:3000`; a custom `WEB_PORT` changes it. Default API readiness is `http://localhost:8080/readyz`, AI readiness is `http://localhost:8000/ready`, local chain RPC is `http://localhost:8545`. These are local addresses, not deployment URLs. The lifecycle command preserves data volumes on shutdown.

`release_journey.py` requires Compose and intentionally publishes synthetic data and local-chain records. It validates/deduplicates 56 Bengaluru observations, persists them through authenticated APIs, checks actual ratios, exports authorized CSV, orchestrates/stores a seven-day forecast, retrieves cited PulseAI evidence and writes an analytical JSON report. It attests the exact report bytes on chain 31337, verifies original/tampered content and configures/restarts the local API to independently validate the real receipt. No private key enters the API. The generated `.build/release-journey/chain.compose.json` contains public local-chain configuration; use it with Compose if restarting that API after the demonstration. Rerunning the journey retains server idempotency behavior; conversation/report IDs and transaction addresses are run-specific.

The CI browser release test makes a real web → Java → AI request, checks seven returned table rows and downloads a CSV. It is explicitly skipped in ordinary web-only tests and only runs with `CITYPULSE_FULL_STACK=true` plus actual API connectivity. Other browser tests cover sample workspace behavior and unavailable-service states; they are not substitutes for this integration test.

## Observed local results

| Check                  | Actual result / boundary                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git integrity/metadata | Correct name/description, preserved history; `git fsck` reports only dangling historical trees, no corrupt objects                                              |
| Frontend               | Clean lockfile installation, production Webpack build, lint/types, 13 unit tests passed                                                                         |
| Browser                | 18 desktop/mobile tests passed, including axe checks, focus/navigation, light/dark portals and reduced motion                                                   |
| Java                   | Build passed; 31 tests discovered, 23 executed, eight Docker-dependent tests skipped after the analytics and JSON-contract regressions were added               |
| AI                     | 48 tests passed, Ruff passed; Python compilation succeeded; one upstream Starlette/httpx deprecation warning                                                    |
| Ingestion              | Six tests passed; deterministic Bengaluru/Amsterdam datasets and duplicate replay demonstrated                                                                  |
| ML                     | Eight synthetic segments trained/evaluated; actual measured output in [evidence/model-evaluation.json](evidence/model-evaluation.json), no field-accuracy claim |
| Contracts              | Compiled; four tests passed; local EVM original proof accepted and tampered proof rejected; Solhint zero errors/six warnings                                    |
| npm runtime audit      | Zero advisories in the recorded scan                                                                                                                            |
| Python runtime audit   | No known vulnerabilities found in the recorded lockfile scan                                                                                                    |
| Development tools      | Five high findings trace to Zod in Hardhat tooling; unresolved upstream compatibility limitation                                                                |
| Secret scan            | Trivy source-secret scan reported no findings; pattern-based repository guard also passed                                                                       |
| Infrastructure scan    | Findings retained below; not asserted clean                                                                                                                     |
| Local Docker           | Docker Desktop failed to start; Linux named pipe unavailable; explicit Compose up failed. No local container/migration/whole-stack pass claimed                 |
| PDF/PPT                | Full documents on main; 79-page PDF and 33-slide deck regenerated, reopened/rendered and passed document CI against the corrected implementation                |

Linux CI verified artifact revision `7d8ce81` in [PR #25](https://github.com/manikantbindass/CityPulse/pull/25): all 31 Java tests passed without skips, along with 48 AI, 13 web unit, 18 regular browser, six ingestion, four contract and seven document tests. The two additional real-stack browser cases passed. Full Compose startup, migrations, tenant/owner tests, least-privilege grants, runtime OpenAPI checks, imported metrics, forecast/explanation/report generation, local-chain attestation and independent Java receipt confirmation passed. [Verification ledger](verification.json) links exact runs; [journey evidence](evidence/journey-summary.json) records actual fingerprints and bounded results. Current PR checks are authoritative for later documentation-only commits.

## Performance and scalability

[Browser observations](evidence/web-performance.json) are a single local Chromium run against a production build, cold browser cache and synthetic pages. Dashboard transferred 379,624 JavaScript bytes (1,237,180 decoded); explorer transferred 757,053 bytes (2,616,398 decoded). This identifies the map/chart stack as a bundle-cost focus, not a measured production bottleneck. Individual timing samples are not percentiles or SLOs. Five actual tenant-scoped AI HTTP forecasts also passed locally; [raw timings](evidence/ai-http-smoke.json) explicitly identify the seasonal-naive fallback and exclude Java/database latency. Existing [k6 evidence](../reports/operations/k6-local-ai.json) is a separate dated 21-request loopback AI smoke workload, not a new release benchmark or whole-stack throughput claim.

Web/API can scale within Redis/database connection budgets. AI SQLite/file persistence requires a single writer and deliberate stop-before-start deployment; EFS does not make it transactionally distributed. PostgreSQL indexes, bounded queries and cache keys exist; representative saturation, soak, failover, restore and real tenant workloads remain untested. SLO/RTO/RPO values in planning docs are targets.

## Security and production gates

Server-side scopes/current memberships and tenant/owner predicates govern access independently of UI roles or LLM output. Local opaque tokens are confined to the explicit local profile; production uses configured OIDC, secure cookies, encrypted server-side token handling and TLS Redis. Integration tests cover unauthorized calls, tenant boundaries, owned conversations/scenarios, input/geospatial constraints and injection regressions. Real issuer enrollment/MFA and account recovery still require operator acceptance.

The runtime dependency audits are clean for the recorded scans, but scans are time-specific. `GHSA-mrhx-c7xc-m3w5` affects developer-only Zod usage in Hardhat and related packages. Current upstream Hardhat/plugins still specify Zod 3; overriding to Zod 4 would change their validation API. Keep these tools local/trusted and revisit upstream migration; do not expose the dev chain/tooling publicly. No advisory was hidden or force-fixed across incompatible major versions.

Trivy configuration review reports five critical findings (four broad-egress rules and an HTTP ALB listener), two high (public ALB and S3 customer-managed-key recommendation), three medium and low findings. The flagged port-80 listener redirects to HTTPS rather than serving application responses; private task HTTP is a separate code-reviewed residual risk. Public HTTPS ALB ingress is intentional; HTTP redirects are not equivalent to encrypted private service links. Private task HTTP, unrestricted destination egress and writable cloud roots remain documented production hardening gates. Customer-managed KMS/state controls, network policy, effective IAM and actual restore rehearsals require an approved deployment review. AWS modules have no applied account evidence. No penetration test, contract audit, certification or production security guarantee is claimed. Slither is unavailable locally; Solhint and contract tests are the executed checks.

## Checklist

- [x] Metadata/history inspected; no force-push or history rewrite.
- [x] Pinned installations, local builds and available suites executed with skips reported.
- [x] Fix missing-side analytics, ambiguous clustering IDs and exact 366-day duration validation; add PostGIS regression.
- [x] Add a real imported-data → forecast/explanation → exported-report → local-chain receipt journey.
- [x] Preserve raw OpenAPI/JSON byte responses by correcting Jackson converter precedence.
- [x] Fix chain-container write permissions for non-root demo artifacts/compilation and force HTTP/1.1 for Hardhat RPC (the real node rejects h2c upgrades).
- [x] Refresh PRD/changelog and identify planned module boundaries.
- [x] Full PDF/PPT merged under explicit user approval; working README downloads.
- [x] Verified candidate CI: migrations, isolation, runtime contracts, actual chain/API integration, browser and scans (exact recorded revision above).
- [ ] Successful local Docker run (host engine unavailable).
- [ ] Owner selects a project license; no license is inferred.
- [ ] Real IdP/MFA, licensed sources, privacy/legal review, operational recovery and production cloud hardening.
- [ ] Separate approval to merge the release PR, publish a version tag or provision any paid infrastructure.

The candidate is suitable for a reproducible synthetic engineering demonstration when its CI gates pass. It is not represented as an operational municipal SaaS release.
