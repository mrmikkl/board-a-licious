# 0004. Neon PostgreSQL via Hyperdrive, local-first sync

- **Status**: Accepted
- **Date**: 2026-10-16
- **Origin**: `specs/001-bgg-game-collection/research.md` R1, R2; spec FR-011, FR-012

## Context

Each person's collection must survive a lost or reset phone, be the same on all their devices, and
keep working offline on the fair floor. The user asked for PostgreSQL if a free option exists.

## Decision

We store user data in Neon PostgreSQL (Free plan), reached from the Worker through Cloudflare
Hyperdrive with a TCP driver (`postgres`). Every row is keyed by the verified user email. The app
is local-first: changes go to IndexedDB immediately and into an outbox that syncs when online.
Conflicts are resolved per record by last write wins on the client timestamp; deletions are
tombstones.

## Consequences

- Offline use and multi-device sync with one simple merge rule.
- Free limits (verified 2026-10-16): Neon 1 GB storage, 100 CU-hours, sleeps after 5 min idle
  (first request after a pause is slower); Hyperdrive 100,000 queries/day. Ample for this group.
- Neon Free keeps only 6 h of restore history: user-held backup files remain worthwhile.
- Last write wins can lose a concurrent edit on two devices of the same person; accepted.

## Alternatives considered

- **Browser-only storage**: lost phone = lost collection.
- **Supabase Free**: pauses inactive projects after a week.
- **Cloudflare D1 (SQLite)**: simpler and native, but not PostgreSQL as requested.
