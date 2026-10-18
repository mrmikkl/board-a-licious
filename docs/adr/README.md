# Architecture Decision Records

Project-wide technical decisions: why we chose what we chose, and what we rejected. Feature
`research.md` files record decisions for one feature; a decision lands here when later features
must respect it too (see [Spec Kit extended](../speckit-extended.md), extension 1).

## Index

| ADR | Title | Status | Date |
|---|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-16 |
| [0002](0002-single-cloudflare-worker.md) | One Cloudflare Worker serves app and API | Accepted | 2026-10-16 |
| [0003](0003-access-control-cloudflare-access.md) | Cloudflare Access with an external identity provider | Accepted | 2026-10-16 |
| [0004](0004-storage-neon-local-first.md) | Neon PostgreSQL via Hyperdrive, local-first sync | Accepted | 2026-10-16 |
| [0005](0005-bgg-adapter-and-bridge.md) | BoardGameGeek behind one adapter, token-free bridge until the XML API | Accepted | 2026-10-16 |
| [0006](0006-typescript-react-shared-domain.md) | TypeScript, React + Vite, shared domain module | Accepted | 2026-10-16 |

## Rules

- File name `NNNN-short-title.md`, numbered in order, never reused. Template: [template.md](template.md).
- Statuses: **Proposed** → **Accepted** (or **Rejected**); later **Superseded by NNNN** or
  **Deprecated**. Accepted ADRs are not rewritten; a change of mind is a new ADR that supersedes
  the old one.
- Every `/speckit-plan` reads the accepted ADRs first; a plan that contradicts one must propose a
  superseding ADR.
