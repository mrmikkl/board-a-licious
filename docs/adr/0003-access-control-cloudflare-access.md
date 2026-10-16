# 0003. Cloudflare Access with an external identity provider

- **Status**: Accepted
- **Date**: 2026-10-16
- **Origin**: `specs/001-bgg-game-collection/research.md` R3; spec FR-013

## Context

Only invited friends (< 10) may use the app; nobody else may see any page. The user wants a real
identity provider and maximum safety, and no passwords or login code inside the app. There are no
roles: every user sees only their own collection.

## Decision

We put Cloudflare Access (Zero Trust Free) in front of the whole hostname, with an allow list of
email addresses. Login methods: email one-time PIN first, Zitadel Cloud (generic OIDC) added
later. The Worker additionally verifies the `Cf-Access-Jwt-Assertion` JWT (JWKS signature, `aud`,
`exp`) and uses its verified email as the user key.

## Consequences

- No auth code, token storage or password handling in the app; nothing is served before sign-in.
- Changing or adding identity providers is dashboard configuration, not code.
- Zero Trust onboarding asks for payment details even on the Free plan (no charge).
- If roles or per-user server features with fine-grained permissions are needed later, in-app OIDC
  becomes a new ADR.

## Alternatives considered

- **In-app OIDC (react-oidc-context + jose)**: more code, static assets stay public, iframe silent
  renew breaks in iOS Safari.
- **Self-hosted Keycloak**: cannot run on Cloudflare; a server to patch for a handful of users.
- **Shared group password**: weak, no individual identity.
