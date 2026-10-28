# Architecture

CityPulse starts with a modular Spring Boot API, a separate Python inference service, and Next.js. PostgreSQL/PostGIS is authoritative. Redis is available for bounded caches and future rate limits; it holds no correctness state. No broker runs because no asynchronous production pipeline exists yet.

## Bounded contexts

| Context               | Ownership                         | Current boundary                          |
| --------------------- | --------------------------------- | ----------------------------------------- |
| Identity and access   | Subjects, scopes, future tenants  | Spring Security local token / OIDC        |
| Geographic registry   | Cities, zones, business locations | Domain, application, JDBC and HTTP layers |
| Ingestion and catalog | Sources, validation, idempotency  | SQL schema; writes planned                |
| Supply and demand     | Compatible aggregates, gaps       | Seed frontend; query service planned      |
| AI forecasting        | Model versions, evaluation        | FastAPI baseline; recommendations planned |
| Attestation           | Digests, receipts, chain state    | Local Solidity; integration planned       |
| Reporting and audit   | Exports, audit trail              | Seed CSV and schema; job service planned  |

## C4 context

```mermaid
flowchart LR
  Citizens[Citizens] --> CP[CityPulse]
  Analysts[Analysts and city planners] --> CP
  Owners[Business owners] --> CP
  Admin[Administrators] --> CP
  Providers[Data providers] -. Planned licensed feeds .-> CP
  CP -. Planned sign-in .-> IdP[OIDC provider]
  CP -. Planned digest submission .-> Chain[Blockchain]
```

## C4 containers

```mermaid
flowchart TB
  Browser[Browser] --> Web[Next.js / server adapters]
  Web -->|Scoped development token| API[Spring Boot modular API]
  Web -->|Forecast HTTP| AI[FastAPI / scikit-learn]
  API --> DB[(PostgreSQL + PostGIS)]
  API --> Redis[(Redis readiness / future cache)]
  API -. Planned orchestration .-> AI
  API -. Planned attestation worker .-> Contract[Hardhat / Solidity]
```

## C4 components

```mermaid
flowchart LR
  Security[SecurityFilterChain] --> Controller[CityController]
  Controller --> Service[CityService application]
  Service --> Port[CityRepository domain port]
  JDBC[JdbcCityRepository adapter] -. Implements .-> Port
  JDBC --> DB[(PostGIS)]
  Flyway[Flyway] --> DB
  Errors[ProblemDetail advice] --> Controller
  Health[Readiness] --> DB
  Health --> Redis[(Redis)]
```

## Deployment: implemented local topology

```mermaid
flowchart TB
  Host[Developer / loopback only] --> Web[web :3000 non-root]
  Host --> API[api :8080 non-root]
  Host --> AI[ai :8000 non-root]
  subgraph Compose[Docker Compose network]
    Web --> API
    Web --> AI
    API --> DB[PostGIS :5432]
    API --> Redis[Redis :6379]
    DB --> Data[(Persistent volume)]
    Redis --> Cache[(Redis volume)]
  end
```

## Data flow

```mermaid
flowchart LR
  Seed[Synthetic fixtures] --> Migration[Local-profile Flyway seed]
  Migration --> Registry[(PostGIS)]
  Registry --> CityAPI[Authenticated city API]
  CityAPI --> Status[Web registry status]
  Synthetic[Typed UI seeds] --> Views[Charts / maps / exports]
  Synthetic --> AI[FastAPI baseline]
  Text[Sample text] --> Hash[Browser SHA-256]
  Hash -. Future .-> Attest[Attestation worker]
  Provider[Future upload] -.-> Validate[Validate / deduplicate / audit]
  Validate -.-> Registry
```

## Fault isolation and scaling

Keep modules in one deployment until measured volume or ownership justifies extraction. Add bounded database-backed import jobs first. For multiple independent consumers and replay, write an outbox in the observation transaction, publish with bounded retries, and introduce Redpanda. Use at-least-once delivery and consumer deduplication; broker settings do not imply exactly-once business effects.

Future public deployment requires tenant authorization, OIDC web sessions, audience checks, rate limits, trace propagation, structured logs, metrics, backup restoration drills and restricted audit writes. Readiness checks database and Redis; liveness checks process state. The web renders without registry connectivity. AI failures remain isolated.

Scale stateless API replicas after a single migration job. Train real models offline with versioned artifacts. The current bounded linear fit is for local experimentation only. Kubernetes/Terraform directories are reserved with no deployed resources.

See [ADRs](decisions/README.md), [API](../api/README.md), [data policy](../data-policy.md) and [PRD](../PRD.md).
