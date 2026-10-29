# ADR 007: Evidence selection before conversational generation

Status: accepted for the local foundation.

The analyst must remain useful without paid credentials and must not invent city
claims. The Spring modular API owns authentication, fixed parameterized tools,
canonical factual statements and citations. FastAPI abstracts an optional provider
that selects allowed statement IDs using a strict schema. Java independently
validates that selection. Source and document text never become executable tools.

This limits conversational flexibility and prevents free-form model explanations.
It gives deterministic fallback and a clear fact/citation boundary. Future richer
responses require evaluated claim-level grounding and permission regression tests.
Session storage stays in PostgreSQL, tenant+subject scoped, expiring after seven
days; daily provider reservations use the existing persistent AI service volume.
A distributed multi-replica provider budget requires a shared atomic ledger before
horizontal AI scaling. No Kafka, vector database or new microservice is justified.
