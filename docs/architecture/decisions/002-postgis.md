# PostGIS and Flyway

Status: accepted

## Context

Geographic relationships and relational constraints must agree.

## Decision

Use WGS84 geometry, GiST indexes, UTC event times, tenant predicates and SQL migrations.

## Consequences

Parent boundary edits need controlled descendant revalidation. Redis is not authoritative.
