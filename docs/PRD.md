# CityPulse product requirements

Status: development release candidate, 30 October 2026. Original concept: Understanding City Supply and Demand Business Analysis Using AI and Blockchain. The release acceptance matrix below supersedes the earlier foundation-only status; operational targets remain unproven until measured in a real deployment.

## Problem and outcome

Urban planners and businesses compare observations from incompatible geographies, periods, units, and sources. CityPulse will make those differences explicit, compare supply and demand, and support auditable decisions. Forecasts inform human review; they do not autonomously allocate public resources.

## Actors

| Actor             | Goal                              | Intended access                                |
| ----------------- | --------------------------------- | ---------------------------------------------- |
| Citizens          | Understand published local trends | Public aggregates, no private business records |
| Business analysts | Compare districts and sources     | Scoped reads, scenarios, exports               |
| City planners     | Investigate service gaps          | Authorized geography and planning scenarios    |
| Business owners   | Evaluate demand and inventory     | Own records and authorized aggregates          |
| Administrators    | Govern access and source quality  | Explicit administrative privileges and audit   |
| Data providers    | Submit licensed observations      | Provider-scoped ingestion and receipts         |

## Scope and acceptance

| Requirement    | Acceptance                               | Release candidate state                                                                                                      |
| -------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Registry       | Authenticated bounded city listing       | Spring API, stable sorting, PostGIS seed                                                                                     |
| Geography      | Filters, overlay and table alternative   | Seed UI with MapLibre/deck.gl                                                                                                |
| Analytics      | Show units, period, source, missingness  | Scoped PostGIS metrics, duration/mode groups, unknown missing sides; sample workspace remains labeled                        |
| Forecast       | Validate inputs, name model and limits   | Versioned jobs, four measured candidates, chronological evaluation, diagnostic residual intervals; field calibration pending |
| Scenarios      | Explain rule and export without dispatch | SciPy constrained allocation, infeasibility, risk weights, owner-scoped persistence and export; no dispatch                  |
| Verification   | Hash locally, disclose chain state       | Authorized Solidity registries, local EVM proof, Java receipt validation; optional testnet not deployed                      |
| Accounts       | OIDC scopes and tenant isolation         | OIDC/PKCE server sessions, encrypted tokens, scopes/membership/tenant checks; real IdP/MFA enrollment unverified             |
| Reports        | Select fields, export accessible CSV     | Bounded authorized CSV and sample browser exports; full PDF/deck with editable sources; async report worker planned          |
| Analyst        | Evidence-backed model disclosure         | Read-only tools, citations, owned sessions, provider abstraction, safe no-provider fallback; paid provider not exercised     |
| Administration | Audited role/provider management         | Tenant-scoped account/configuration APIs and audit trail; admin UI remains a preview                                         |

## Nonfunctional requirements

Future pilot targets, requiring measurement: p95 registry reads under 300 ms at 50 concurrent clients and 100k rows; p95 baseline inference under 2 s for 10k samples; 99.5% monthly availability; RPO 24 h and RTO 4 h using tested backups. These are not current guarantees.

Target WCAG 2.2 AA: complete keyboard access, visible focus, meaningful labels, reduced motion, and nonvisual alternatives for charts/maps. Automated checks supplement manual testing. No critical workflow depends solely on color.

Bound requests, connections, queues and retries. Store times in UTC and display city IANA timezone. Minimize personal data, enforce purpose-based retention, record freshness, and log trace IDs without secrets. API replicas must remain stateless; deployment must serialize schema migrations.

## Incremental releases

1. Foundation: contracts, schema, local services, seed workspace, tests and docs.
2. Evidence pilot: provider validation, idempotent ingestion, lineage, authorized aggregates, OIDC sessions and tenant policy.
3. Decision support: seasonal backtesting, uncertainty calibration, drift monitoring, human-reviewed recommendations, audited reports.
4. Scaling: database-backed workers, then transactional outbox and Redpanda when replay or independent consumers justify a broker. Extract services for measured bottlenecks or independent ownership.

Public SaaS, billing, real partnerships, autonomous allocation, mainnet transactions, Kafka, Kubernetes and Terraform deployment are out of scope for this candidate. Terraform modules exist as validated design/code; no cloud apply has occurred. General tenant-shared business records do not implement an individual business-owner policy. See the [release audit](release/README.md) for verification scope and remaining gates.

## Pilot measures

Measure source completeness, rejected rows, forecast error against a seasonal naive baseline, investigation time, accessibility task completion and audit reconstruction. Establish real baselines before claiming improvements.
