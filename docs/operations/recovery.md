# Backup, disaster recovery and restore validation

No production backup or disaster-recovery drill has been executed. This is an operator design plus infrastructure retention settings, not an RTO/RPO guarantee.

## Data and initial planning assumptions

RDS has 14-day automated backup retention, encryption, Multi-AZ and deletion protection; enable cross-region/account backup copies and test PITR before a real availability commitment. Multi-AZ is availability, not protection from logical deletion. S3 has versioning, TLS-only access and noncurrent-version retention; object lock/cross-account copies require a separate legal/operational choice. EFS has an AWS Backup policy but its regional default backup plan, retention and restore access must be inspected and documented after deployment. Redis has seven-day snapshots, but sessions/caches should be recreated rather than restored after compromise.

Proposed starting RPO is one hour for authored data and RTO four hours for a sandbox recovery; neither is proven. AI SQLite/file state requires coordinated stop-the-writer snapshots and consistent model/artifact fingerprints. SQLite online file copying without its WAL/checkpoint is not an acceptable backup.

## Safe rehearsal

1. Inventory schema/version, immutable image digests, model versions, secret references and last durable ingestion checkpoints. Record counts/checksums without exporting PII into tickets.
2. Take encrypted logical backups through a dedicated read identity; use `pg_dump --format=custom --no-owner --no-acl`. Put credentials in a protected secret mount/`.pgpass`, not shell history. Store backup integrity hashes separately; never commit dumps.
3. Restore into a new private database/account using compatible PostgreSQL/PostGIS, `pg_restore --no-owner --no-acl --exit-on-error`, and approved operator credentials. Verify extension/schema versions, constraints, counts and checksums. Reapply least-privilege roles/audit restrictions; runtime must not gain owner privileges.
4. Replay only idempotent ingestion receipts/checkpoints after identifying recovery-point losses. Verify tenant and owner isolation, auth, import, forecast/scenario reproduction and export hashes. Verify selected on-chain attestations against restored off-chain bytes; chain history cannot be rolled back by a database restore.
5. For AI, stop the single writer, restore a consistent state/artifact pair, reopen SQLite, validate fingerprints and run actual sample inference. Start one task only. Invalidate sessions and rotate affected secrets after an incident; do not recover revoked session handles from general backups.
6. Measure actual recovery duration/data loss, verify private networking and TLS, then separately approve DNS/traffic cutover. Retain the former system read-only for reconciliation if safe. Document failures and update the next drill, rather than declaring the plan successful because a snapshot exists.

The [security runbook](../security/operations.md) covers containment, disclosure and key rotation; the [deployment guide](deployment.md) covers compatible application rollback. Routine `dev_stack.py down` never removes volumes. Destructive volume deletion/destroy is intentionally not part of one-command startup/stop.
