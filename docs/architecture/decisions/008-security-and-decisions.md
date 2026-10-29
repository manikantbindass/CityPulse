# ADR 008: Constrained decisions and centralized browser authentication

Status: accepted for the development foundation.

Use the existing Python service with SciPy LP/MILP for bounded inventory transport,
instead of introducing a scheduling microservice. Preserve observations, forecasts,
inventory stocks and business assumptions separately. Store immutable tenant/owner
snapshots and audited scenarios in PostgreSQL, with canonical fingerprints and
explicit infeasibility. No Kafka or routing provider is justified without real data.

Centralize all browser adapters on OIDC or an explicitly enabled local identity.
Use a maintained OIDC client, PKCE/state/nonce and signature validation, then verify
backend membership. Store encrypted short-lived access tokens server-side in Redis
behind opaque Secure cookies; no refresh-token persistence. Scope and tenant checks
remain independently enforced in Java. Configure provider MFA with verified ACR,
not a local password/MFA implementation. Dynamic CSP nonces trade static rendering
for a stronger script boundary. Inline style allowance remains for maps/charts.

Separate runtime database DML from migrations, pin CI actions and scan runtime
images. Actual IdP enrollment, backup restore drills, penetration tests and compliance
attestation remain deployment/organizational tasks and are not claimed as completed.
