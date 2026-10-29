# Executive summary

CityPulse integrates urban supply-demand investigation with explicit geography, provenance, forecasting, constrained optimization and selected blockchain attestations. Its original concept is to understand city supply and demand through AI and blockchain. The implemented system combines a Next.js workspace, modular Java/Spring API, isolated Python service, PostgreSQL/PostGIS, Redis, an ingestion CLI and locally tested Solidity registries.

The contribution is an inspectable engineering platform rather than a new forecasting algorithm, an operational municipal deployment or a measured urban intervention. Sample dashboards and reproducible experiments are synthetic. Real HTTP integration and persistence are exercised in Linux CI, while the local browser can run an explicitly labeled unsaved SciPy scenario. Source licenses, real provider completeness and operational acceptance remain separate prerequisites.

The inspected baseline includes 29 Java tests, 48 AI tests, 13 web unit tests, 18 desktop/mobile browser tests, six ingestion tests and four Solidity tests with supporting CI evidence at the recorded revisions. Two mocked Terraform plans check infrastructure safety properties. Compose verifies real service requests, persistence, idempotent publication, runtime DB grants, metric scrapes and actual trace ingestion. These are bounded engineering checks, not penetration testing, an availability history or compliance certification.

The machine-learning evaluation covers eight synthetic city/district/category segments. Chronological validation selects among seasonal-naive, moving average, Ridge and XGBoost; untouched test results are retained per candidate. Residual-based intervals and recursive widening are explicitly diagnostic. The selected candidate is not necessarily best on the held-out test period. Synthetic error does not establish real-city accuracy.

A k6 arrival workload sent 21 real synthetic decision requests over 20 seconds directly to the updated FastAPI service. HTTP failures were zero and p95 request duration was 74.68 ms. The measurement excludes browser, Java, database and external-network latency; it is not a production throughput claim. The solver reports infeasible, unsupported and insufficient-data states instead of manufacturing allocations.

Security uses configured OIDC/PKCE, encrypted server sessions, active membership narrowing, tenant/owner predicates, strict request limits, minimized logs and restricted runtime database privileges. Actual external-provider enrollment, operational MFA, independent security review and restore drills remain unverified. A matching chain digest demonstrates byte integrity, not source truth. AWS infrastructure is validated code, not a deployed environment; AI persistence remains single-writer.

# Abstract and introduction

Urban resource analysis requires reconciling quantities across geography, time, category and source coverage. CityPulse explores an architecture that keeps these dimensions explicit while connecting analytical, forecasting, optimization and verification workflows. The project evaluates software behavior and reproducible computational experiments, rather than asserting policy effectiveness or commercial success.

The methodological source hierarchy is deliberate: executable code and migrations govern implementation claims; structured evaluation files govern measured results; workflow logs establish which checks actually ran; later operational documents describe unverified deployment gates. Earlier PRD, frontend and architecture drafts contain obsolete planned/implemented statements and cannot override newer code. This report curates those contradictions instead of reproducing them as current facts.

The engineering questions are whether an authorized analyst can reconstruct a scenario from canonical inputs and fingerprints; whether missing observations remain explicit; whether a solver preserves hard policy constraints when infeasible; whether retrieved instructions can introduce unsupported model claims; and whether another party can compare exported bytes with a recorded digest. Tests support bounded answers, while field evaluation and operational assurance remain future work.

Keywords: urban analytics; geospatial provenance; chronological evaluation; tenant isolation; constrained allocation; evidence-grounded assistant; content attestation; reproducible deployment.

# Problem statement, motivation and objectives

A district can show demand while another holds inventory, but combining those numbers is meaningful only if units, commodity, interval and coverage agree. Business-location density is not service capacity; inventory is not a flow; an absent supply report is not confirmed zero supply. A forecast can conceal rather than solve this measurement problem if its uncertainty and training provenance disappear in a dashboard.

CityPulse makes these distinctions part of data and workflow. Observations separate event time from ingestion time, retain source/mode/schema metadata and use bounded measurement units. Geographic containment and tenant-safe references constrain storage. Server-derived filters and ownership rules determine retrievable evidence. Human reviewers can inspect assumptions before accepting a recommendation; no optimization result dispatches resources.

Objectives are to preserve traceable observations, compare compatible evidence, evaluate forecasting against transparent baselines, formulate constrained resource scenarios, explain uncertainty and support independent integrity checks. Supporting objectives include finite request/compute budgets, explicit failure states, accessible interaction and a progressive infrastructure path without automatic cloud expenditure.

The practical motivation is reconstructability: an analyst should be able to identify the source records, model version, business assumptions and constraints behind a result. This is a software design objective. The project has not measured reductions in municipal cost, improved access, business profit or real-world forecasting error.

# Existing approaches and gap analysis

Spreadsheets, GIS applications, forecasting notebooks, optimization scripts and audit ledgers are valid tools within their domains. Their integration can lose semantics: a notebook forecast may be copied without its training period, a dashboard may combine unequal units, and an exported recommendation may omit the policy assumptions that produced it. This is a qualitative engineering gap analysis, not a benchmark or competitive-product feature survey.

CityPulse addresses these transition points through typed requests, provenance fields, canonical snapshots, versioned computation and protected retrieval. Its assistant returns only verified statement selections and citations constructed by the API. A digest receipt is separated from an independently confirmed chain receipt. The user can inspect underlying assumptions rather than infer certainty from visual polish.

The proposed solution is intentionally modular. The browser explores, the API authorizes and persists, the numerical service names models and constraints, and the blockchain records selected attestations. Introducing Kafka, Kubernetes or additional model families without measured need would not itself resolve missing data, licensing or organizational ownership. Those remain pilot acceptance requirements.

# Scope, users and requirements

The demonstrated scope is a local/CI platform with one shared web app, a modular API, isolated Python computation, an operator ingestion CLI and local EVM tests. Admin and reporting features are existing UI/API boundaries; reserved directories do not imply separately deployed services. Billing, self-service tenant signup, autonomous dispatch, licensed live city partnerships and a public mainnet service are not demonstrated.

| Actor          | Use case                                       | Authorization boundary                                                 |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| Citizen        | Inspect permitted registry context             | Registry scope; no implicit access to private analytics                |
| Analyst        | Compare records, forecasts and scenarios       | Active membership, scopes and owned decision objects                   |
| Planner        | Review budget, capacity and fairness scenarios | Human-reviewed recommendations, no dispatch                            |
| Business owner | Investigate tenant-authorized business data    | General business rows are tenant-scoped, not individually owner-scoped |
| Administrator  | Provision memberships and inspect audit        | Server policy; cannot remove final active administrator                |
| Data provider  | Publish licensed source observations           | Strict validation, provenance and idempotent writes                    |

Functional acceptance means observable behavior: invalid geometry/units are rejected, protected lists are bounded, retried writes preserve identity, models disclose versions/limits, missing evidence is not invented, scenarios can be saved/exported/reproduced and foreign owned objects do not disclose content. Later chapters map these requirements to code, routes, demonstrations and tests.

Nonfunctional requirements include visible keyboard focus, responsive layouts, reduced motion, bounded parser/body/solver inputs, private identity boundaries, minimized logs and reproducible builds. Operations proposes 99.5% eligible-request availability, sub-500 ms p95 registry reads at validated load and sub-two-second small computation latency. Earlier PRD targets differ; all remain proposed until measured under a defined workload and acceptance policy.

# Technology choices and tradeoffs

| Choice                         | Rationale                                                         | Material tradeoff                                                  |
| ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| Next.js / React / TypeScript   | Routing, typed interaction and server adapters                    | Dynamic nonce CSP changes rendering/caching assumptions            |
| Spring Boot 4 / Java 21        | Validation, authorization, transactions and migration discipline  | Temporary Jackson 2 bridge is deprecated and needs later migration |
| FastAPI / SciPy / scikit-learn | Numerical isolation, validated requests and inspectable artifacts | SQLite/files constrain distributed execution                       |
| PostgreSQL / PostGIS           | Transactional spatial and temporal integrity                      | Projection, containment and coverage need explicit semantics       |
| Redis                          | Shared sessions, short cache TTL and request admission            | Failure must not bypass security checks                            |
| Solidity / OpenZeppelin        | Role-controlled digest attestations                               | Gas, keys, finality and immutable-data limitations                 |
| Compose then ECS               | Reproducible integration before managed deployment                | Mock plans do not verify real AWS permissions or service health    |

The architecture favors modular simplicity over premature service fragmentation. Java owns canonical business operations; Python isolates numerical dependencies; the web layer exposes interaction and protects adapters. ADRs record domain boundaries, geographic integrity, measured model selection and delayed event infrastructure. ADR 009 adds the managed-cloud path and explicitly retains a single AI writer.

No broker is deployed merely for an event-driven label. Optional SQS/DLQ resources have no connected consumer, while Redpanda/Kafka and Kubernetes remain future decisions. Extraction should follow independent scaling, replay, ownership or deployment evidence. PyTorch, a second tree implementation and an extra animation engine are omitted without evidence of added value.

# Complete system architecture

At context level, actors enter a decision-support system, while configured identity, licensed providers and an optional chain are external boundaries. The identity provider owns passwords and optional MFA. Providers remain untrusted until schema, provenance and licensing checks pass. Chain state can attest a digest but cannot establish that an observation was true.

At container level the browser enters through Next.js. The BFF resolves an opaque server session or explicit bearer identity, bounds input and calls Spring. Spring validates the token and current membership, applies tenant/owner scopes, accesses PostGIS/Redis and orchestrates Python. The Python service accepts protected internal credentials and a server-derived tenant header; deployment does not make it a public end-user API.

An explicit local adapter may evaluate synthetic/manual scenarios directly in Python when both preview flags are enabled. It does not retrieve tenant evidence, persist an audited Java scenario or prove production authorization. The interface labels that narrower computation as local and unsaved. Production must disable these flags.

The C4 and sequence diagrams in this report are generated from editable node/edge descriptions. They show current runtime and storage ownership rather than repeating obsolete phase-one diagrams. Planned infrastructure and operator actions are labeled separately; no asynchronous consumer, public deployment or distributed transaction is inferred from an arrow.

# Backend components and request lifecycle

Security filters establish identity, narrow permissions against enabled membership and limit requests before application services perform business work. Controllers validate DTOs and route to application operations. Registry repository ports separate domain-facing behavior from JDBC, while workspace operations use tenant-bound JPA/JDBC and transactional receipts. Error advice exposes meaningful known statuses without leaking raw exception details.

A decision request illustrates the separation. Next verifies origin, resolves authorization and bounds streamed bytes. Java derives tenant and actor, checks permissions, resolves an owned immutable snapshot and any licensed network reference, limits concurrent computation and calls Python. Python validates finite scenario dimensions and returns a solve status, diagnostics, canonical input, versions and fingerprints. Java persists the owned scenario/audit; the UI displays that actual response.

These layers provide fault isolation, not unlimited independence. Database or Redis readiness can affect API admission; Python failure affects numerical operations while registry reads may remain possible. A valid solver result does not grant permission to persist or dispatch it. Idempotency guards retried writes; it does not turn an unavailable service into a successful action.

# Frontend architecture and accessible product behavior

The shared Next.js app includes marketing, features, sign-in, dashboard, explorer, intelligence, predictions, opportunities, optimization, verification, analyst, reports, notifications, settings, admin and help routes. Unknown sections return 404. TanStack Query owns request state and caching; Zustand persists local filters, theme, demo persona and read markers. These preferences never authorize server operations.

Recharts, MapLibre and deck.gl provide charts/overlays with textual or table alternatives. Heavy modules load selectively. Motion is restrained and disabled for reduced-motion preferences. Seed KPIs and illustrative charts remain labeled synthetic, while configured evidence, forecast jobs and optimization use real endpoints. A backend failure must not promote seed values into apparently live intelligence.

Issue #22 and PR #23 corrected portal theming: the selected theme now lives at the document root, the notification provider receives it explicitly, and appearance controls wait for saved-state hydration. The browser regression covers dark/light command dialogs, native controls, notifications, mobile navigation, keyboard focus and reload/navigation persistence. It also exposed a 4.25:1 default success-toast contrast, corrected without weakening the accessibility check.

The interface is tested with automated axe checks and keyboard/mobile journeys. That is not a complete manual accessibility audit or screen-reader certification. The administrator persona changes navigation only. Authentication uses the configured OIDC provider and does not collect preview passwords. Additional real-user and assistive-technology evaluation remains part of pilot acceptance.

# Database, PostGIS and canonical semantics

The schema evolves through versioned migrations: city/zone/business/source/observation/inventory/audit are extended by tenants, organizations, memberships, geographic hierarchy, notifications, operation receipts, forecasts, chain confirmation, conversations and decision objects. V1 alone is not the complete protected schema. The appendix extracts physical declarations and later column additions from the actual SQL.

Cities/zones use nonempty valid WGS84 MultiPolygons. Business locations are longitude-first Points. Geographic-parent triggers and composite references constrain inserts/updates. Parent boundary edits still require controlled descendant revalidation. GiST supports spatial access; tenant/time and tenant/name indexes support protected operational queries. Distances and areas use geography or explicit projected coordinates rather than raw degrees interpreted as metres.

City definitions can be shared through tenant_city assignment, so the ERD does not falsely make every city directly tenant-owned. Business/source/observation/inventory rows carry tenant scope, with composite constraints for sensitive references. Conversations and decision objects add subject ownership. General business rows are not individually owner-scoped inside a tenant, which gates mixed-owner production use.

Observation quantity, commodity, unit and event interval define a flow. Inventory is a recorded stock snapshot. ingested_at is distinct from observed_at. Runtime grants permit required reads/inserts but not schema changes, migration-history access or audit mutation; owner credentials remain powerful. Append-only application grants are not an external immutable log service.

# Analytical methodology and missingness

For compatible records define demand D and supply S. Imbalance is D - S; shortage is max(D - S, 0); surplus is max(S - D, 0). Demand/supply ratio is undefined for zero supply, while gap share requires positive demand. These quantities describe the selected records, not complete citywide unmet need.

Compatibility is the substantive assumption: commodity, unit, geography, interval, mode and coverage must agree. AnalyticsService separates source modes and interval durations, uses UTC daily buckets and discloses limits. Some legacy conditional sums return zero when a side is absent; shortage/ratio fields therefore require missing-coverage caution. Newer PulseAI groups and decision snapshots preserve an absent counterpart as unknown. Neither proves complete source coverage without an upstream coverage contract.

Business density uses registered counts divided by geodesic city area. The proximity indicator counts businesses with another registered business within one kilometre; it is not population accessibility. DBSCAN projects small-city points to local UTM, using a one-kilometre neighbourhood and two-point minimum. Large multi-zone geographies, high latitudes, incomplete registrations and network accessibility require other methods.

Historical comparisons need matching cadence and local-calendar interpretation. UTC day buckets can cross the city's calendar boundary. Volatility and seasonal differences are indicators, not causal explanations. The system does not infer population, capacity, opening hours, road travel time or resource utilization from absent datasets.

# Training evaluation and interpretation

The committed evaluation includes eight synthetic city/district/category segments with 182 daily rows each. Chronological 60/20/20 splits separate parameter fitting, validation selection and held-out reporting. Features are lag 1/7/14, the previous-seven mean and known weekday sine/cosine. Geographic/category models are separate; no unseen-city transfer result is claimed.

Candidates are seasonal-naive, seven-point moving average, Ridge with alpha 10 and bounded XGBoost. Validation MAE selects a candidate per segment. The complete candidate table is retained, including cases where the selected candidate is not best on the untouched test period. Charts read the committed JSON, not invented scores.

MAE measures absolute error in the synthetic target units; RMSE emphasizes larger errors; sMAPE uses the implemented symmetric denominator with zero contribution when both values are zero. Directional under/overforecast exposes asymmetric risk. Evaluation is rolling one-step: prior observed test values become available at later origins, while no future target enters its own features. This does not establish recursive multi-horizon accuracy.

Intervals use a 90th percentile absolute validation residual, but validation also selects the model. They are empirical diagnostics, not independently calibrated conformal guarantees. Square-root horizon widening is heuristic. Measured synthetic coverage must not be generalized to a real provider, changing reporting process or unseen geography. Real adoption requires separate calibration and multi-horizon backtests.

# Optimization formulation and explanations

Each permitted source-to-district lane has a nonnegative allocation x; z represents minimum coverage. Outgoing allocation cannot exceed stock. Incoming quantity is bounded by positive demand gap and receiving capacity. Supplied stock/lane unit costs determine the budget constraint. Category-incompatible and excluded travel lanes are not permitted variables.

The hard coverage floor requires availability plus received quantity to reach the greater of global and district coverage times demand. Infeasibility does not silently relax this policy. Missing demand or availability returns insufficient_data; travel limits without actual lane times return unsupported_constraint. No road network or travel estimate is invented.

Throughput maximizes allocated units, coverage weights relative district coverage/priority, fairness maximizes z, cost minimizes expense under hard constraints, and balanced normalizes configured objective weights. Cost can validly allocate nothing when no floor requires positive allocation. Secondary cost minimization removes expensive ties within tolerance. Continuous cases use linprog/HiGHS; integral cases use milp with z continuous, bounded time and independent residual/integer checks.

Opportunity scores combine configured gap, forecast growth, seasonality, accessibility, density and risk. Missing optional features renormalize available weights instead of inventing values. These scores are not success probabilities. Multi-city comparison requires matching unit, period, currency and evidence definitions. Canonical inputs/fingerprints aid reconstruction; they do not prove the assumptions true or dispatch a plan.

# Testing strategy and evidence boundaries

Unit tests target calculations and validation; Spring HTTP and Testcontainers tests target identity, tenant/owner scope, idempotency and PostGIS constraints. Browser cases test routes, user controls, exports, mobile layouts, failures, accessibility and persisted state. Solidity tests exercise local authorization/replay/proof paths. Integration smoke calls actual services and checks persisted responses rather than replacing them with canned success.

The source manifest records measured revisions and workflow URLs. The baseline supports 29 Java tests with zero CI skips, 48 AI, 13 web unit, 18 browser, six ingestion, four contract tests and two mocked Terraform plans. Local Java skips seven Docker-dependent tests because Docker Desktop could not start; those skips are not local integration success. Linux CI supplies that evidence.

Compose validates forecasts, PulseAI evidence, saved scenarios, exports, idempotent data publication and restricted DB grants. Telemetry smoke verifies actual API/AI Prometheus scrape targets and spans stored in Tempo. Security jobs audit dependencies, scan secrets/source/configuration/images and produce CycloneDX inventories. Zero fixable HIGH/CRITICAL findings in the recorded images does not imply zero lower-severity or vendor-unfixed risk. A Hardhat development advisory remains disclosed.

These checks answer bounded engineering questions. They do not replace actual IdP/MFA enrollment, external penetration testing, a professional contract audit, field validation, manual accessibility review, representative saturation tests or recovery drills. No coverage percentage or production SLA is fabricated.

# Demonstration scenarios and practical value

An ingestion walkthrough generates fixed-seed example-city rows, inspects normalized/quality/checkpoint/dead-letter output, publishes through the authorized API and replays. Acceptance is successful created-or-replayed behavior without duplicate writes, with provenance and times intact. A local checkpoint alone is not proof of remote publication.

An evidence walkthrough creates an owned PulseAI session and selects an assigned city, compatible commodity/unit/window. The rice fixture has demand without matching supply: the correct response explains why shortage cannot be established, cites allowed records and declines unsupported conclusions. A foreign session/tenant reference must not reveal content.

A numerical walkthrough trains the synthetic segments, reviews every candidate's validation/test results, activates an existing registry version and submits an actual forecast job. A planning walkthrough compares budget/capacity/floor/objective changes, preserves explicit infeasibility and distinguishes unsaved local results from Java-persisted owned scenarios. Export/reproduction refers to the evaluated input, not later form edits.

A proof walkthrough hashes the same exported bytes, submits an authorized local attestation, compares the receipt and changes one byte for a mismatch. The recorded gas of 150,788 applies to that local demonstration on chain 31337, not public-network fees. Blockchain protects a content reference, not measurement truth.

Potential value is reconstructable analysis for retail, logistics and public-service investigations. Real improvements in analyst time, service access, loss reduction or business profit have not been measured. A pilot must establish source completeness, outcome baselines, decision ownership and ethical/legal constraints before attributing benefits to the application.

# Current limitations, future work and conclusion

The primary limits are evidentiary and operational. Sources are synthetic unless separately configured and licensed. Missing coverage, overlapping providers, unequal periods and geographic definitions can invalidate apparent comparisons. Forecast errors are synthetic and one-step; residual intervals and horizon widening have no universal guarantee. Optimization assumes supplied costs/capacities and does not dispatch resources or derive routes.

Production identity, MFA, recovery and access reviews need actual provider validation. General business data needs individual-owner policy for mixed-owner tenants. Independent security review, Slither and restore exercises remain unperformed. Source deletion does not remove bytes already on a public chain or data retained in backups.

AI metadata uses SQLite/files, so a single writer and stop-before-start deployment are deliberate. EFS persistence is not distributed transaction safety. Durable workers, central job/model metadata, outbox/leases and object-store artifact integration remain future work. AWS modules are schema/mock-plan validated, not applied; private internal HTTP, broad NAT egress and writable ephemeral cloud roots remain documented deployment gaps.

The next meaningful milestone is a controlled pilot with licensed assessed data, verified ownership/identity boundaries, representative workload, recovery evidence and independent feedback. Scaling complexity should follow those measurements. CityPulse demonstrates disciplined integration and reproducibility, not certified production readiness, municipal adoption or guaranteed business success.
