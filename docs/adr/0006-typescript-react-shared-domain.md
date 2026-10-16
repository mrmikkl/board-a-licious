# 0006. TypeScript, React + Vite, shared domain module

- **Status**: Accepted
- **Date**: 2026-10-16
- **Origin**: `specs/001-bgg-game-collection/research.md` R6, R8; constitution II and III

## Context

The app runs in mobile browsers and on the Workers runtime. Rules such as states, merging,
validation and share-text formatting are needed on both sides. The constitution requires domain
logic separate from the UI and test-first development.

## Decision

We write everything in TypeScript. The UI is React with Vite, `vite-plugin-pwa` for the service
worker and `idb` for IndexedDB, styled with plain CSS custom properties (no component library).
Domain logic lives in `src/domain/` with no React, DOM or Workers imports and is used by both the
app and the Worker. Tests: Vitest (domain, client), `@cloudflare/vitest-pool-workers` (Worker),
PGlite (database without Docker), Playwright with axe at phone width (end to end, accessibility).

## Consequences

- One language and one copy of each rule; domain code is unit-testable without a browser.
- No component library: the look comes entirely from our design rules (extension 2).
- React adds bundle weight compared with lighter frameworks; acceptable for this app.

## Alternatives considered

- **Svelte / Preact**: lighter, but less familiar; no current need justifies the switch.
- **A component library (e.g. MUI)**: faster start, but heavier and fights custom design rules.
