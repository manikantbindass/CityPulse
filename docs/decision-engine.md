# Opportunity and optimization engine

The `/opportunities` and `/optimization` routes share seven dashboard views: scored
opportunities, coordinate gap overlay, inventory simulator, district/city comparison,
scenario comparison, operating-budget investigation and decision explanation.
Synthetic retail, logistics and public-service fixtures are in `data/sample/decisions`.
They imply no access to real-time city data or guaranteed profit.

## Run and reproduce

Start the stack with `python scripts/setup-env.py` (only for a new `.env`) and
`docker compose up --build -d --wait`. Existing `.env` files need a distinct random
`DATABASE_PASSWORD` for the new restricted runtime role. Open `/opportunities`,
choose a fixture and **Run & save via API**. Server sessions/scenarios require an
authorized identity; explicit loopback local Compose uses its development identity.
For synthetic-only host development, enable both `PULSEAI_LOCAL_PREVIEW=true` and
`DECISION_LOCAL_PREVIEW=true` with the configured AI URL/token. Local evaluation
uses SciPy but has no durable server audit trail. Real snapshots require Java.

```sh
python -m pytest services/ai-engine/tests/test_decisions.py
python scripts/decision_demo.py
```

Use the AI virtual environment containing the locked dependencies. The demo emits
[measured synthetic evaluations](reports/decision-evaluation.json) and the canonical
[scenario JSON schema](../packages/contracts/decision-scenario.schema.json).
Record solver version and hashes; numerical equality across versions is not promised.

## Domain and assumptions

One scenario fixes a unit, currency, time zone and positive half-open interval up
to 366 days. It supports up to 30 district/category groups, ten stocks and 300 lanes.
Demand, existing availability and forecasts remain separate. Categories are canonical
commodities/service quantities, not automatically inferred industry taxonomies.
Retail uses kg in its fixture; public service uses integer service counts. No currency
conversion or aggregation of unlike units occurs. Multi-city scores weight groups
equally and disclose missing groups. Cross-scenario numerical comparison rejects
different periods/units/currencies and labels source mode separately.

Operator risk, accessibility, density reference, priorities, costs, capacities,
coverage floors, multipliers and seasonal baselines are assumptions. Opportunity
score is a weighted mean of available gap share, inverse assumed risk, accessibility,
inverse relative business density and bounded seasonal change. Missing features are
listed and remaining weights renormalized. Missing demand/availability means no score;
missing is never zero. Factor contributions explain every score. These are heuristics,
not calibrated investment probabilities, revenue forecasts or business valuations.

SciPy HiGHS solves a transport allocation with variables per permitted source/group
edge and one minimum-coverage variable. Stocks constrain outbound quantities;
receiving capacity and positive gaps cap inbound quantities; costs constrain total
budget. Category matching prevents rice becoming water. Per-district and global
coverage floors are hard lower bounds, never silently relaxed. Continuous allocations
are divisible; `integral=true` uses SciPy MILP for whole units. Allocation never dispatches.

Objectives are total throughput, priority-weighted quantity coverage, minimum cost,
max-min fairness, or a configurable normalized weighted combination of throughput,
cost and fairness. Secondary minimization reduces cost while retaining the primary
objective within tolerance. Cost-only objectives can correctly allocate zero without
positive coverage floors. The engine independently checks residual constraints and
integrality. Each solve is bounded to two seconds; primary/secondary and alternatives
can require multiple solves. Feasible objective comparisons are not a complete
Pareto frontier. Time-limit, solver-error, insufficient-data and infeasible results
have no fabricated allocation. Infeasibility diagnostics are not an IIS proof.

Stocks are explicit inventory, never inferred from observed surplus flows. Registered
or assumed direct lanes can constrain per-unit cost, capacity and maximum travel
minutes. Without supplied lanes, travel constraints return `unsupported_constraint`.
This does not solve vehicle tours, congestion, schedules, time windows or a real road
graph. The map is a coordinate overlay without a street basemap or inferred routes.
Population accessibility, profitability, fixed capital costs and legal permits are
outside this engine. Expansion suggestions are investigation candidates only.

## API and provenance

All `/api/v1/decisions` routes require signed analytics/data scopes and active tenant
membership; writes additionally require analytics write. Ownership is tenant+subject.

| Method | Route                       | Behavior                                                                                         |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------ |
| POST   | `/snapshots`                | Authorized cities/categories/unit/from/to → immutable observations and latest reported inventory |
| POST   | `/networks`                 | Register direct lanes against tenant source metadata and an explicit license                     |
| POST   | `/scenarios`                | `{scenario: <schema>}` plus Idempotency-Key → validate, solve, save input/result and audit       |
| GET    | `/scenarios?page=0`         | Owned scenario metadata, 20 per page                                                             |
| GET    | `/scenarios/{id}`           | Owned immutable result with input and associated snapshot/network                                |
| GET    | `/scenarios/{id}/export`    | Authorized JSON attachment                                                                       |
| POST   | `/scenarios/{id}/reproduce` | Re-evaluate frozen input with current engine and report hash matches                             |

The AI internal route is `POST /v1/decisions/evaluate` with service Bearer credential
and tenant UUID. FastAPI generates OpenAPI and validates the scenario JSON schema.
Spring rejects missing/invalid fields and owns authorization/provenance. Internal
service credentials do not authorize a browser identity. No arbitrary SQL executes.

Authorized snapshots overwrite client-supplied measured quantities on every run;
only explicit business assumptions remain editable. Snapshot aggregation requires
one data mode and interval duration; missing temporal coverage or observation sides
remain unknown. Inventory is latest per business/category/unit within the window;
reported inventory age and source completeness require review. Snapshot source IDs
and inventory/observation references are stored. Forecast association requires an
explicit operator mapping from stored forecast to registry zone/category/units and
daily horizon; no automatic geographic or unit inference is asserted. Sources can
be incorrect even when authorized. Fingerprints attest reproducibility, not truth.

Saved scenarios include canonical input, output, engine/SciPy version, input/result
SHA-256, timestamp, subject and audit event. Compute time is excluded from result
fingerprints. Export contains the frozen snapshot/network when retained. Defaults
retain scenarios 90 days and unreferenced snapshots 30 days; deployment settings
and backups require separate review. There is no production workload benchmark or
investment success claim.
