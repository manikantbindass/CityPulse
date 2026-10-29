# Data dictionary

| Object / field                        | Meaning and validation                                                 |
| ------------------------------------- | ---------------------------------------------------------------------- |
| tenant.id                             | UUID derived from trusted identity and scoped membership               |
| city / zone boundary                  | Nonempty valid WGS84 MultiPolygon; longitude first                     |
| geographic_area.kind                  | REGION, DISTRICT or NEIGHBORHOOD with tenant-safe parent               |
| business.location                     | Point within its zone; no personal address is collected                |
| source.provider / source_uri          | Provider name and traceable source identifier                          |
| source.license_reference              | Explicit reuse terms or a blocked-review statement                     |
| source.update_frequency               | Provider schedule or manual generation, never implied real-time        |
| source.data_mode                      | synthetic, historical or live, asserted and reviewable                 |
| source.quality_status / source_schema | Validation status and versioned field contract                         |
| source.timezone / currency            | IANA timezone and ISO currency code; no automatic conversion           |
| observation.kind                      | supply or demand                                                       |
| observation.commodity / unit          | Controlled comparable commodity and unit (count, kg, litre, kwh, trip) |
| observation.quantity                  | Finite nonnegative numeric(18,4), no silent rounding                   |
| observation.observed_at / period_end  | Offset-aware positive interval stored UTC                              |
| observation.ingested_at               | Actual database ingestion time, separate from event time               |
| observation.source_id / external_id   | Unique provider record boundary for deduplication                      |
| observation.payload_sha256            | Digest of submitted representation; canonical policy must be versioned |
| observation.provenance                | Source/mode/schema and normalization evidence, no secrets              |
| observation.quality_score             | Rule-based score 0..1, not model confidence or source truth            |
| inventory.recorded_at                 | Inventory snapshot time, not inferred demand                           |
| audit_event                           | Tenant, actor subject, action, resource and event time                 |
| operation_receipt                     | Tenant/subject/operation/key request digest and replayable result      |
| forecast_result                       | Tenant-scoped request, actual inference result and creation time       |
| verification_request                  | Digest receipt with onChain=false, not proof of chain submission       |

Offline interchange accepts JSON arrays, CSV header tables and Point GeoJSON Features. Geographic boundary GeoJSON is a different schema and is never interpreted as observations. Raw inputs reject unknown columns to reduce accidental PII. Missing source coverage is unknown rather than zero. See [pipeline](ingestion.md), [data policy](data-policy.md), and [backend](api/backend.md).
