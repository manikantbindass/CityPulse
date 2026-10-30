# Validation record

Historical phase log. For current candidate results and remaining gates, read the [release audit](release/README.md). The statements below describe earlier revisions and must not be interpreted as current feature status.

29 October 2026. This branch is a development foundation, not a production release.

## Observed results

- Repository metadata: name remains `CityPulse`; requested description and eleven topics applied and read back through authenticated GitHub CLI.
- Original commit `16f980485447371d9c412a7173a508328c9e0fb4` preserved; all work occurs on `feat/citypulse-foundation`.
- Next.js production build completed for the initial workspace routes. The latest advanced ML additions require a fresh final build recorded below when available.
- Four React component/state tests passed.
- Nine initial FastAPI/domain tests passed, with a Starlette/httpx deprecation warning. Advanced model tests are included; final expanded results must be checked separately.
- Java verification passed: eleven tests discovered, seven executed successfully, four Docker-dependent tests skipped. New ML orchestration requires final verification.
- Five offline ingestion tests passed: invalid fields, quantities, timezones, geographic bounds, duplicates, conflicting digests, normalization, GeoJSON and metric calculations.
- Bengaluru and Amsterdam synthetic generators each produced 56 observations. Incremental replay skipped all 56 identical observations without new writes.
- A real public Census TIGERweb query returned one historical-vintage state boundary FeatureCollection. This is licensed geography, not a live supply/demand source. Provenance metadata is committed; raw output remains local.
- Reproducible ML training evaluated eight synthetic city/district/category segments with chronological splits and actual MAE/RMSE/sMAPE reports in `model-evaluation.json`. No real-world accuracy is claimed.
- Local Solidity compilation and attestation test passed after upgrading the test runner.
- Production npm dependency audit reported zero vulnerabilities after compatible updates. Development-tool advisories must be assessed separately.
- Technical report rendered to seven PDF pages. Presentation exported, rendered, inspected and passed package/layout/import validation.

## Remaining verification and deployment boundaries

Docker Desktop has not provided a reachable Linux engine in this session. Compose startup, real PostGIS migrations, cross-service persistence and Testcontainers assertions therefore cannot be claimed verified locally. `docker compose config --quiet` checks configuration without running containers. CI defines Docker-backed integration tests on Linux.

Browser screenshots, automated accessibility, full end-to-end flows and runtime performance measurements require the running production web build and Playwright; do not interpret the presence of tests as a passing result. No coverage percentage, SLO, load capacity or production security claim is made.

OIDC issuer setup and real web sessions, owner-specific policy within shared business tenants, public hosting, tenant onboarding/deletion, retention automation, real provider feeds, LLM chat and chain transaction submission remain incomplete and explicitly documented.

## Reproduce

Use [developer commands](development.md), [ingestion demo](ingestion.md), [backend behavior](api/backend.md), and [model card](model-card.md). Inspect GitHub Actions for branch-specific results. A badge without a completed workflow is not test evidence.

## Subsequent validation and blockchain extension

- Advanced FastAPI/model tests: all 13 passed after correcting integer-array sMAPE handling; Ruff passed.
- Expanded Java build: 14 tests discovered, 10 executed successfully, 4 Docker tests skipped locally. The earlier PR revision also passed Java integration CI on Linux.
- Four Solidity tests passed, including malicious callers, source revocation, pause, duplicates and independent proof comparison. Solhint: 0 errors / 6 warnings, detailed in the blockchain guide. No audit is claimed.
- Actual ephemeral EVM demo deployed three contracts, estimated and used 150788 gas for a synthetic report attestation, verified the original report, and rejected altered content. Captured evidence is in [local demo JSON](reports/blockchain-local-demo.json). The ephemeral chain ended; its transaction is not a public-network transaction. Persistent local RPC connectivity has been unreliable on this host.
- Next.js Webpack production compilation, TypeScript, prerendering and build tracing completed. Turbopack worker launch failed on this Windows environment; Linux CI had built the previous revision successfully.
- Initial Linux browser run: 7 passed / 3 failed. Fixes address hidden mobile auth heading, unnamed search button, scrollable table keyboard access and loading landmark/test ambiguity. A new browser/CI run is required for the final revision.
- [Desktop report view](assets/workspace-desktop.png) and [mobile report view](assets/workspace-mobile.png) are actual screenshots from the successful initial CI interaction flow, with synthetic data.

No claim is made that pending final CI or unavailable Docker-local checks have passed.

- A subsequent persistent local node on loopback port 8547 completed deployment and attestation, and a separate read-only process verified the exported report through RPC. [Persistent local evidence](reports/blockchain-persistent-demo.json) captures the actual receipt and addresses. No public network deployment was performed.

- Updated PR revision `97d21fe`: GitHub Linux web job passed all browser checks, Java job passed, and contracts job passed. Its remaining ingestion-test setup failure was a missing temporary parent directory on a clean checkout; the test suite now creates that directory explicitly. The AI tests themselves passed in that CI run. Final head checks must still be read from GitHub Actions.
