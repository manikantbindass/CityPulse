# Security policy

Do not publish exploitable details, credentials or private records in issues. Use Security → Report a vulnerability when enabled; otherwise contact the owner through their GitHub profile to arrange a private channel. No response SLA is promised. The latest default-branch revision is the supported development version.

This foundation has no production security certification. Compose binds to loopback; its explicit local token profile grants local development permissions. Never expose it publicly. The default API validates OIDC issuer, audience, JWT scopes and tenant claims. UI demo personas grant no server permissions.

Web server adapters use a development service token and require real per-user sessions, CSRF protection for cookie auth, tenant authorization, TLS and quotas before hosting. No token uses NEXT_PUBLIC variables. CORS is same-origin by default. API bearer authentication is stateless; CSRF is disabled only for that bearer boundary.

Tenant predicates scope protected data queries. Redis limits authenticated traffic and caches city reads for 30 seconds. Keep Redis trusted/private. Imports are JSON only, bounded to 1 MB and 500 validated rows. Idempotency receipts and audit writes share transactions. Retention deletion workers, legal holds, and backup expiry remain planned; see [data policy](docs/data-policy.md).

Store only digests on a chain, never personal or private payloads. A digest proves neither source truth nor authority. Hardhat keys must never secure public-network assets. Dependency scanners and tests are partial defenses, not proof of safety.
