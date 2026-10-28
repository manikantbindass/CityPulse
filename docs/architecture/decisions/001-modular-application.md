# Modular application

Status: accepted

## Context

Service fragmentation would introduce distributed transactions before demonstrated need.

## Decision

Keep bounded contexts in one Java deployment; isolate Python libraries in FastAPI.

## Consequences

Extract for measured load or independent ownership; domain ports keep that option open.
