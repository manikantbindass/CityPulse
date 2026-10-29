# Security operations, deployment and recovery

## Secure deployment checklist

- Use HTTPS for browser, IdP, session store and production service boundaries. Set
  exact issuer/audience and HTTPS `WEB_ORIGIN`; register only the exact callback URI.
- Disable both preview flags. Do not deploy the `local` Spring profile. Configure
  production IdP claims `tenant_id`, `sub`, `aud`, `scope`, short expiry and optional
  exact `acr`. Register two authorized administrators before normal use.
- Generate a random 32-byte session key: `openssl rand -base64 32`. Deliver it and
  client/service/database secrets through a secret manager or mounted runtime
  secret mechanism. Never bake them into images, commit them, or print them.
- Use a private TLS Redis store, restrictive ACLs and encryption-at-rest. Verify
  cookie Secure/HttpOnly/SameSite flags, login/callback failure, membership denial,
  logout, expiry and optional MFA on the actual provider before enabling traffic.
- Run migrations in an isolated job, then set `FLYWAY_ENABLED=false` in the runtime
  and remove migration credentials. Supply `DATABASE_USER=citypulse_app` and its
  distinct password. Confirm runtime cannot CREATE, DROP, UPDATE/DELETE audits or
  read Flyway history. Do not expose DB, Redis or FastAPI to the Internet.
- Apply edge request-size, connection, body-read timeout and pre-auth/IP limits;
  trust no arbitrary forwarded headers. Review CSP and failed auth logs; never log
  token-bearing query strings, callback codes, passwords, raw prompts or bodies.
- Review all CI artifacts and open dependency advisories. Rebuild and rescan images
  after vendor fixes. Confirm no production credentials are available to fork PRs.
- Apply backups, restore drills, retention and legal-hold procedures appropriate
  to your data and jurisdiction. No compliance determination is supplied here.

## Account/key management

IdP administrators own onboarding, MFA, recovery and account suspension. The app
stores subject/display name and tenant membership only. First verify the real IdP
subject, then provision the tenant membership via the authorized admin API. Disabling
it immediately removes API access because membership is rechecked. Offboarding must
also disable the IdP account and invalidate app sessions. Test this with multiple
tenants; do not assume token expiry alone is immediate revocation.

Rotate OIDC client secrets using the provider's overlap procedure, update the secret
store, restart web instances and confirm a real login. Rotate the session key by
deploying the new value and clearing `session:*` and `oidc:flow:*` in the dedicated
session Redis database; users must reauthenticate. Only execute deletes against the
dedicated session database after verifying its URL/database index. Do not use
FLUSHALL on shared Redis. The code intentionally has no old-key decrypt fallback.

For service-token rotation coordinate API and FastAPI atomically; otherwise calls
fail closed. For database passwords rotate the runtime role independently of the
migration owner, drain/restart pools and verify privileges. Public-chain signers
must use a managed signer/HSM or protected wallet. Hardhat keys are local fixtures,
never deployment assets. Rotate contract roles through an authorized multisig where
supported and verify receipts; on-chain events cannot be erased.

## Backup/restore design

Use encrypted, access-controlled logical backups with `pg_dump --format=custom
--no-owner --no-acl`; use a dedicated backup identity with necessary read rights,
not the web process. Keep credentials in `.pgpass`/secret mounts with restrictive
permissions. Require transport encryption, backup integrity hashes, immutable/offline
copies and a separate retention schedule. Never commit database dumps. Suggested
initial planning targets: daily backups and a monthly isolated restore rehearsal;
RPO/RTO must be measured, not promised.

Restore into a fresh private database with matching PostgreSQL/PostGIS versions.
Use `pg_restore --no-owner --no-acl --exit-on-error`, run schema/integrity checks,
reapply runtime grants and audit immutability, then compare counts/checksums and
exercise tenant-isolation/authentication smoke tests. Do not restore sessions or
production signer secrets from a general database dump. Rotate app/session secrets
after a breach. Production backup automation and a completed restore drill are
not claimed by this repository; record drill duration and recovery gaps separately.

## Incident response runbook

1. **Triage:** record UTC incident time, generated request IDs and affected service,
   tenant and release. Avoid copying sensitive payloads into tickets or chat.
2. **Contain:** remove public ingress or disable the affected route/tenant; suspend
   implicated memberships/IdP subjects; rotate leaked credentials and invalidate
   sessions. Preserve logs before changing retention. Never destroy evidence or
   assume blockchain deletion is possible.
3. **Assess:** identify access boundaries, data types, timeline, secrets and backup
   exposure. Use least-privilege forensic access. Determine notification obligations
   with the responsible organization; no legal deadlines are invented here.
4. **Eradicate:** remediate root cause, pin reviewed updates, rescan and add a regression
   test. Rebuild signed/reviewed images through trusted CI; do not hot-patch secrets
   into source or bypass failed required checks.
5. **Recover:** restore from a verified clean backup if needed, reapply roles, rotate
   credentials, verify tenant isolation and release gradually with monitoring.
6. **Learn:** publish an appropriately redacted post-incident review with owner,
   corrective actions and measured detection/recovery times. Review controls and drills.

Private disclosure follows [SECURITY.md](../../SECURITY.md). This runbook has not
been exercised against a production incident or certified by an external assessor.
