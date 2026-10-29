# Security verification evidence

This file records actual checks, not a penetration-test or compliance report.
Final PR check links and any unresolved findings are added after CI completes.

Implemented regressions cover access-token tenant/lifetime/assurance checks,
session encryption/tampering/key rotation, explicit anonymous-delegation denial,
same-origin browser mutations, strict JSON imports, protected exports, owner-scoped
scenarios, membership revocation, final-admin lifecycle and prompt injection.

Local results before CI:

- Python: 46 tests passed (forecasting, provider fallback/prompt injection and
  decision constraints). One existing Starlette/httpx deprecation warning.
- Java build/tests passed locally; PostGIS tests require Docker and are skipped
  here because Docker Desktop cannot start its engine. CI runs those tests on Linux.
- OIDC/session helper and UI control tests pass; production Next build passes with
  nonce CSP and dynamic rendering. Actual external IdP/MFA enrollment is not tested
  without provider configuration. No passwords are collected by CityPulse.
- Production npm dependency audit has no high/critical finding at the current
  check. Full developer-tree audit reports the Zod constrained-collection advisory
  through Hardhat's Zod 3 dependencies. Latest Zod 3 has no published compatible fix;
  forcing Zod 4 is incompatible with Hardhat's Zod 3 API. Treat as an open developer
  tooling risk: run local chain/tooling on loopback with trusted bounded inputs and
  update once upstream fixes it. No silent audit exclusion or false clean claim.
- Trivy source/config/image results and dedicated secret scan are recorded by the
  security workflow. Image gating covers fixable HIGH/CRITICAL findings; unfixed
  vendor advisories remain a separate review responsibility.

The workflow also runs dependency audits, CodeQL, Solidity authorization/duplicate
tests and Solhint. No Slither result, contract audit, authenticated external-IdP
penetration test, production backup restore drill or SOC assessment is asserted.

See [operations](operations.md) for the deployment checklist and unresolved
operational controls. Scan results are point-in-time and must be rerun after changes.
