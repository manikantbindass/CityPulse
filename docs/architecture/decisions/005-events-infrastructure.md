# Compose before distributed infrastructure

Status: accepted

## Context

No production event flow currently justifies a broker or cluster.

## Decision

Use local PostGIS/Redis and no broker. Add database-backed jobs before an outbox/Redpanda.

## Consequences

At-least-once delivery needs deduplication. Kubernetes and Terraform remain planned.
