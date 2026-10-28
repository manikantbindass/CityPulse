# Cross-service validation

Run `python scripts/smoke.py` against the running stack for real web/API/AI checks.
Web component and browser tests live under `apps/web/tests` and `apps/web/e2e`.
Java tests live in `services/api/src/test`, including Docker-dependent PostGIS and HTTP integration tests.
AI tests live in `services/ai-engine/tests`; Solidity tests in `blockchain/test`.
Testcontainers skips without Docker must be reported, not counted as successful integration evidence.
