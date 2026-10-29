# OIDC and tenant scopes

Status: accepted

## Context

UI state cannot authorize protected actions. External IdP owns credentials.

## Decision

Validate issuer/audience and scope claims. Derive tenant from signed JWT, never a caller header. Use local random token only in local profile.

## Consequences

Per-user web sessions and provider setup remain required. Database account roles narrow application permissions.
