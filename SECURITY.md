# Security policy

Do not publish exploitable details, credentials or private records in issues. Use Security → Report a vulnerability when enabled; otherwise contact the owner through their GitHub profile to arrange a private channel. No response SLA is promised. The latest default-branch revision is the supported development version.

This foundation has no production security certification. Compose binds to loopback; its explicit local token profile grants local development permissions. Never expose it publicly. The default API validates OIDC issuer, audience, JWT scopes and tenant claims. UI demo personas grant no server permissions.

Web adapters use shared OIDC session/bearer authentication; development-token delegation requires explicit local preview and is disabled when an issuer is configured. Production requires HTTPS, a private TLS session store and IdP provisioning. See [security architecture](docs/security/architecture.md) for the implemented boundary and its limitations. No token uses NEXT_PUBLIC variables. CORS is same-origin by default. API bearer authentication is stateless; CSRF is disabled only for that bearer boundary.

Tenant predicates scope protected data queries. Redis limits authenticated traffic and caches city reads for 30 seconds. Keep Redis trusted/private. Imports are JSON only, bounded to 1 MB and 500 validated rows. Idempotency receipts and audit writes share transactions. Conversation and decision retention workers are implemented; legal holds and backup expiry require separate operational controls; see [data policy](docs/data-policy.md).

Store only digests on a chain, never personal or private payloads. A digest proves neither source truth nor authority. Hardhat keys must never secure public-network assets. Dependency scanners and tests are partial defenses, not proof of safety.

Security documentation: [STRIDE model](docs/security/threat-model.md), [incident/rotation/restore runbook](docs/security/operations.md), [illustrative control mapping](docs/security/controls.md), and [verification evidence](docs/security/verification.md). No penetration test, audited-contract claim or compliance certification is made.
