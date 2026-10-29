# CityPulse product requirements

Status: local development foundation, 29 October 2026. Original concept: Understanding City Supply and Demand Business Analysis Using AI and Blockchain.

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

| Requirement    | Acceptance                               | Foundation state                                       |
| -------------- | ---------------------------------------- | ------------------------------------------------------ |
| Registry       | Authenticated bounded city listing       | Spring API, stable sorting, PostGIS seed               |
| Geography      | Filters, overlay and table alternative   | Seed UI with MapLibre/deck.gl                          |
| Analytics      | Show units, period, source, missingness  | Seed comparisons; real queries planned                 |
| Forecast       | Validate inputs, name model and limits   | FastAPI linear baseline; calibration planned           |
| Scenarios      | Explain rule and export without dispatch | Local proportional allocation                          |
| Verification   | Hash locally, disclose chain state       | SHA-256 UI and Solidity prototype; integration planned |
| Accounts       | OIDC scopes and tenant isolation         | Resource server boundary; auth UI is a preview         |
| Reports        | Select fields, export accessible CSV     | Local seed export; formula-injection mitigation        |
| Analyst        | Evidence-backed model disclosure         | Fixed rules on seed data; LLM planned                  |
| Administration | Audited role/provider management         | Audit schema and preview; writes planned               |

## Nonfunctional requirements

Future pilot targets, requiring measurement: p95 registry reads under 300 ms at 50 concurrent clients and 100k rows; p95 baseline inference under 2 s for 10k samples; 99.5% monthly availability; RPO 24 h and RTO 4 h using tested backups. These are not current guarantees.

Target WCAG 2.2 AA: complete keyboard access, visible focus, meaningful labels, reduced motion, and nonvisual alternatives for charts/maps. Automated checks supplement manual testing. No critical workflow depends solely on color.

Bound requests, connections, queues and retries. Store times in UTC and display city IANA timezone. Minimize personal data, enforce purpose-based retention, record freshness, and log trace IDs without secrets. API replicas must remain stateless; deployment must serialize schema migrations.

## Incremental releases

1. Foundation: contracts, schema, local services, seed workspace, tests and docs.
2. Evidence pilot: provider validation, idempotent ingestion, lineage, authorized aggregates, OIDC sessions and tenant policy.
3. Decision support: seasonal backtesting, uncertainty calibration, drift monitoring, human-reviewed recommendations, audited reports.
4. Scaling: database-backed workers, then transactional outbox and Redpanda when replay or independent consumers justify a broker. Extract services for measured bottlenecks or independent ownership.

Public SaaS, billing, real partnerships, autonomous allocation, mainnet transactions, Kafka, Kubernetes and Terraform deployment are out of scope for this foundation.

## Pilot measures

Measure source completeness, rejected rows, forecast error against a seasonal naive baseline, investigation time, accessibility task completion and audit reconstruction. Establish real baselines before claiming improvements.
