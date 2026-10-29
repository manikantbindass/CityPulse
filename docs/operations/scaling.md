# Scaling decisions, workload evidence and cost assumptions

## Current limits and next steps

Web/API are stateless with shared Redis sessions, cache/limits and PostgreSQL persistence. ECS starts two replicas of each only after explicit activation, and caps CPU autoscaling at four. A ten-connection Hikari pool means up to 40 API connections at that cap, plus migrators/operators and safety margin. Choose RDS memory/max_connections from measured workload; do not raise pools to hide slow queries. Observe pool wait, DB CPU/IO/locks and query plans first. Existing tenant/geospatial/temporal indexes remain; run `EXPLAIN (ANALYZE, BUFFERS)` on representative authorized queries in staging without sensitive result logging.

Cache TTL is bounded and tenant keys are preserved. Invalidation must follow writes affecting a cached result; never share tenant-derived cache keys. Measure hit/miss and invalidation behavior before extending TTL. Use keyset pagination/summary tables for large histories only after query evidence warrants the change.

AI uses SQLite/files and a model registry. One task/writer and stop-before-start deployment are deliberate limits. EFS supplies persistence, not a distributed transaction/locking architecture. Before horizontal AI scaling, move job metadata/leases to PostgreSQL, store immutable artifacts in object storage, add idempotent bounded workers and prove concurrent retry/rollback behavior. The optional SQS/DLQ infrastructure has no connected consumer today. No Kafka/Redpanda is introduced without an actual ordering/throughput requirement.

The existing forecast API handles individual versioned requests. Batch callers should submit bounded chunks, limit concurrency to two, reuse stable idempotency keys and record each job ID/error; they must not bypass tenant access or retry permanent 4xx failures. Scheduled retraining remains an operator workflow. A durable batch scheduler, transactional outbox and SQS worker are planned, not implemented distributed processing.

Decision solver limits: 30 district/category groups, ten stock sources, 300 lanes, finite quantities and bounded compute time. Requests report infeasibility/time limits instead of manufactured allocations. Do not infer network routing without actual licensed lane/network input.

## Reproducible k6 workload

Install k6 2.3.0 from its official release and verify its published SHA256. Supply `LOCAL_API_TOKEN` via an ignored environment source; the workload never prints it.

```bash
# Existing synthetic retail fixture, actual AI endpoint, no response mocks.
BASE_URL=http://127.0.0.1:8300 TARGET_MODE=ai k6 run tests/load/smoke.js
# API requires a running authorized Java/PostGIS stack.
BASE_URL=http://127.0.0.1:8080 TARGET_MODE=api k6 run tests/load/smoke.js
# Health-only web smoke is a separate, weaker workload.
BASE_URL=http://127.0.0.1:3300 TARGET_MODE=web k6 run tests/load/smoke.js
```

PowerShell uses `$env:BASE_URL='...'` and `$env:TARGET_MODE='...'` before `k6 run`. Set `SUMMARY_PATH` to retain each JSON summary. Default is one arrival/second for 20 seconds, two preallocated/four maximum VUs. Gates: p95 under two seconds, under 1% HTTP failures, all semantic checks pass and no dropped iterations. These intentionally small smoke gates are not capacity tests or proof of the proposed SLO. Record machine/runtime, duration, route, concurrency, data mode, warm/cold state, failures and raw summary. Local full-stack load/container tests are blocked by Docker Desktop; Linux CI exercises integration. Measurements from direct AI exclude Next/Spring/network/database latency.

Measured outputs, when produced, are retained under [operation reports](../reports/operations). Do not substitute an expected performance number when a workload cannot run. Longer soak, spike, tenant-fairness, DB saturation, failover and restore/load tests remain required before production capacity promises.

## Planning cost envelope

No paid resources were created or priced as a binding quote. Illustrative monthly inputs for a 730-hour two-AZ staging design: 4 aggregate Fargate vCPUs/10 GiB at baseline, two NAT gateways, one ALB, Multi-AZ RDS db.t4g.small, two cache.t4g.small Redis nodes, 30 GiB RDS plus backups, EFS/S3/log/trace traffic. At web/API scale cap, CPU/memory and connection spend rise. AI remains one task.

For early budgeting only, reserve roughly **USD 450–900/month**, excluding tax, support, IdP, external LLM calls, heavy egress, large backup growth and cross-region DR. This is a broad engineering allowance, not a measured bill or current regional quote. Before any apply, replace it with a dated regional AWS Calculator estimate and approved usage caps; include per-hour compute, NAT processing/public IPv4, ALB LCUs, storage/IO, logs, data transfer and backup retention. Zero ECS service count does not stop data/network charges. Compare single-AZ sandbox compromises explicitly rather than silently weakening availability settings.

Authoritative inputs: [Fargate pricing](https://aws.amazon.com/fargate/pricing/), [VPC/NAT/IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/), [AWS Calculator](https://calculator.aws/). Regional rates and service availability can change.

Scaling triggers: sustained web/API CPU over 60% with healthy DB → bounded scale-out; pool waits/DB IO saturation → query/index/cache investigation before replicas; AI queueing/compute latency → size-bound requests and durable-worker design; stale ingestion → source/retry investigation; recurring budget burn → freeze feature rollout and remediate. Validate every trigger against actual telemetry and documented costs.

## Recorded local result

On 2026-10-29, k6 2.3.0 sent 20 real synthetic decision requests at one arrival/second over 20 seconds to the updated FastAPI/SciPy service on loopback. All semantic checks passed; HTTP failure rate was 0%; p95 request duration was 74.80 ms. See the [raw summary](../reports/operations/k6-local-ai.json) for averages, maxima, thresholds and the environment. This excludes web/API/DB latency and provides no production capacity estimate.
