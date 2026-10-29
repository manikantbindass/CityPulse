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

## Runtime findings and remediation

The first Trivy runtime-image scan identified high/critical vulnerabilities in the
previous Spring Boot 3.5.11 dependency set and bundled npm/Yarn tooling. The API is
upgraded to Spring Boot 4.0.9 / Framework 7.0.10 with the coherent Boot-managed
Security, Tomcat, Netty, Micrometer, PostgreSQL and Jackson patch versions. Public
Framework 6.2 releases did not provide the indicated critical MVC fixes; a major
upgrade was necessary. OpenAPI and test modules are adapted to Boot 4. The official
Jackson-2 compatibility module temporarily preserves existing DTO/tree contracts;
its eventual replacement with Jackson 3 is planned. This is a documented deprecated
bridge, not a claim that obsolete Jackson libraries remain patched indefinitely.

The API image upgrades Alpine packages, including the affected Brotli library.
The web runtime removes unused npm, Corepack and Yarn (build-stage tooling remains
isolated). A read-only runtime does not require package installation. Native image
health checks remediate the three low-severity configuration findings. Final image
scan evidence must confirm remediation; no vulnerability suppression file was added.
