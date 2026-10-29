# Canonical data and lifecycle

EPSG:4326 is canonical, longitude before latitude. Cities/zones use valid nonempty MultiPolygons; business Points must lie within their zone. GiST indexes support spatial queries. Inserts and child updates enforce containment. A future parent-boundary write service must lock and revalidate descendants; arbitrary parent geometry SQL edits are unsupported. Cast to geography for geodesic meters, never treat degrees as meters.

UUIDs identify records. UTC `timestamptz` separates event and ingestion time; IANA timezone names control display. Future ingestion validates timezones against the runtime database, coordinate bounds, polygon validity, unit compatibility, provider licensing, and temporal windows.

Supply/demand share an `observation` table distinguished by `kind`. Periods must be positive, quantities nonnegative, quality scores 0..1. Never aggregate incompatible units, commodities, or windows. Inventories are snapshots rather than transactions. Every observation requires source metadata, payload SHA-256, and object provenance. `(source_id, external_id)` is unique; future ingestion returns 409 if that key is reused with a different digest. Hash a documented canonical representation for real attestation. Fixture hashes explicitly hash a synthetic source string.

Validation sequence: bound file size/type; validate interchange schema and provider scope; resolve geometry and business/city consistency; deduplicate and detect conflicts; write observation/audit atomically; quarantine rejected rows with sanitized diagnostics. Schema constraints exist; upload and quarantine services are planned.

## Proposed retention

| Data                              | Duration      | Action                                       |
| --------------------------------- | ------------- | -------------------------------------------- |
| Raw uploads and rejects           | 30 days       | Delete after import/investigation            |
| Detailed observations/inventories | 24 months     | Aggregate then delete under source agreement |
| Anonymous monthly aggregates      | 5 years       | Annual reidentification review               |
| Audit events                      | 12 months     | Restricted access; legal holds override      |
| Local browser preferences         | Until cleared | User controlled                              |

These are policy targets requiring jurisdiction/provider review. No automated deletion runs. [Retention preview](../scripts/retention-preview.sql) is read-only. Implement legal holds, deletion workers, backup expiry and monitoring before a pilot. Chain stores digests only; deleting off-chain data cannot erase a chain digest.
