# 0002. One Cloudflare Worker serves app and API

- **Status**: Accepted
- **Date**: 2026-10-16
- **Origin**: `specs/001-bgg-game-collection/research.md` R5

## Context

The app is a single-page web app plus a small server part: a BoardGameGeek proxy that holds the
BGG token and the collection API. Everything must run on free tiers, sit behind one login, and stay
simple (constitution IV). The initial idea was Cloudflare Pages for the app plus a separate Worker
for the proxy.

## Decision

We deploy one Cloudflare Worker with static assets: it serves the built SPA and handles `/api/*`.
Secrets (BGG token) and bindings (Hyperdrive) attach to this Worker.

## Consequences

- One deploy, one configuration, one hostname to protect with Access, no cross-origin calls.
- Locally, Vite and Wrangler run together; the API and the app share one origin.
- Tied to the Workers runtime (no Node APIs without compatibility flags).

## Alternatives considered

- **Pages + separate Worker**: two deploys and cross-origin requests for no benefit.
- **Pages + Pages Functions**: equivalent capabilities; a valid switch if Pages is preferred.
