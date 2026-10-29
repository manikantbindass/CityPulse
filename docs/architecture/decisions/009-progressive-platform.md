# ADR 009: Progressive platform with a single AI writer

Status: accepted for development; cloud provisioning unvalidated.

Keep Compose as the executable integration environment and ECS/Fargate as the first cloud path. Use private managed PostGIS/Redis, immutable image digests, separate migration secrets, a TLS ALB, encrypted persistent state and bounded web/API scaling. Service counts stay zero until operator bootstrap. Keep cloud apply outside CI, and validate Terraform using provider schemas and mocked plans.

Use OpenTelemetry with allowlisted trace attributes, private Prometheus endpoints and explicit proposed SLOs. Local Prometheus/Grafana/Tempo provides inspectable signals without paid accounts. Do not claim alert delivery, a production restore or SLO attainment without evidence.

SQLite-backed AI persistence prevents safe multi-writer horizontal scaling; retain one writer with stop-before-start deployments. EFS persistence is not a replacement for distributed transaction/lease design. Durable queue consumers, transactional outbox, object-store artifacts and optional Kubernetes remain future work. SQS/DLQ may be provisioned explicitly but no consumer is implied.

Tradeoffs: private HTTP between ECS tasks, broad NAT egress and writable ephemeral task roots are documented deployment hardening gaps; real AWS verification, mTLS, backup drills and measured regional costs gate production use. This choice favors an inspectable incremental deployment path over a second orchestration system without a demonstrated requirement.
