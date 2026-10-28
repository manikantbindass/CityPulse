# Contracts and versioning

The [OpenAPI contract](../../packages/contracts/openapi.yaml) describes implemented boundaries. Runtime schemas: Spring `/v3/api-docs` (authenticated) and FastAPI `/openapi.json`. Small TypeScript integration types live in `apps/web/lib/contracts.ts`; generated clients and automated drift checks are planned.

`GET /api/v1/cities?page=0&size=20` returns `{items:[{id,name,countryCode,timezone}],page,size}` sorted by name then UUID. Page 0..100000; size 1..100; no total count claimed. Requires `registry:read` scope or the explicit local token. Invalid paging returns 400, unauthenticated 401, insufficient scope 403.

AI `POST /api/v1/forecasts` takes equally spaced finite `values` (3..10000, 0..1e12), integer `horizon` (1..168), and `interval_minutes` (1..1440). Returns model, predictions, interval and baseline disclosure, without calibrated intervals. Requires the local service token; invalid input returns 422, authentication 401, unconfigured token 503.

Problem Details use `type`, `title`, `status`, optional `detail`/`instance`, and a stable `code` for application errors. Clients tolerate extra fields. Framework-generated errors may omit custom codes; uniform mapping and trace correlation are planned. Internal errors must not expose stack traces.

Breaking changes use `/api/v2`; additive optional fields stay v1. Publish deprecation notices and a migration window before removal. Source schema/model versions are independent of API versions. Future events include event ID, schema version, source, time, trace ID and tenant scope. Future writes require provider-scoped idempotency, digest conflict detection and atomic audit. Large observation streams should use opaque time+UUID cursors.
