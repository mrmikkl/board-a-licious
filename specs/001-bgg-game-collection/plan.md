# Implementation Plan: BGG Game Collection

> **Status**: Outdated. Written before the design session of 2026-10-17, which reshaped the spec
> (several collections, Essen type, facts, swiping, marks incl. Unsure / Not interested, bought with
> price, filter). Re-run `/speckit-plan`; accepted ADRs in `docs/adr/` stay valid.

**Branch**: `001-bgg-game-collection` | **Date**: 2026-10-16 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-bgg-game-collection/spec.md`

## Summary

A mobile-first web app to search BoardGameGeek and geeklists, mark games with a state, and use
the personal collection at the Spiel 26 fair, with plain-text sharing and backup files. One
Cloudflare Worker serves the React SPA and a small `/api`: a cached BGG proxy holding the BGG token,
and per-user collection storage in Neon PostgreSQL via Hyperdrive. Cloudflare Access with Zitadel
as login method keeps everyone but invited friends out. The app is local-first: IndexedDB plus an
outbox keep the collection usable offline and sync it when back online.

Delivery is split because the official BGG XML API token may be approved only after SPIEL Essen
(2026-10-22): **Release 0.5 (before the fair)** reads game details and geeklists from BGG's public
website JSON (constitution v1.1.0, Principle V exception) and searches only inside loaded
geeklists; **Release 1.0 (token granted)** swaps the BGG adapter to the official XML API and adds
search across all of BGG.

Change to the user input: the collection is stored in PostgreSQL rather than only in the browser,
because a free option exists (research R1); the spec's FR-012 was updated to match.

## Technical Context

**Language/Version**: TypeScript 5.x; Node.js 22 LTS for tooling

**Primary Dependencies**: React 19, Vite, vite-plugin-pwa, idb (frontend); Wrangler, `postgres`
driver, `jose`, `fast-xml-parser` (Worker)

**Storage**: Neon PostgreSQL (Free) via Cloudflare Hyperdrive; IndexedDB on the device

**Testing**: Vitest, @cloudflare/vitest-pool-workers, PGlite, Playwright + @axe-core/playwright

**Target Platform**: Current mobile Safari and Chrome; Cloudflare Workers runtime

**Project Type**: Web application (SPA + edge API in one Worker)

**Performance Goals**: Search to marked game < 20 s (SC-001); geeklist ready < 10 s (SC-002);
state change ≤ 2 taps (SC-003)

**Constraints**: Offline-capable collection (SC-004); 360 px width, WCAG 2.2 AA (SC-006); all
services on free tiers; BGG token never in the client; BGG requests cached (FR-015)

**Scale/Scope**: < 10 users, a few hundred games each; ~4 screens (Search, Geeklist, Collection,
Share/Backup)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Pre-research | Post-design | How the design complies |
|---|---|---|---|
| I. Mobile-First & Accessible | ✅ | ✅ | 360 px-first CSS, 44 px targets, no hover-only actions; Playwright at 360×740 with axe (R8) |
| II. Test-First | ✅ | ✅ | Vitest/PGlite/Workers pool; BGG only via recorded fixtures; tasks will order tests before code |
| III. Logic separate from UI | ✅ | ✅ | `src/domain/` has no React/DOM imports; BGG, DB and IndexedDB behind interfaces with fakes |
| IV. Simplicity (YAGNI) | ⚠️ | ✅ justified | Extra pieces (Postgres, Zitadel) are justified in Complexity Tracking; one Worker instead of Pages + Worker; no roles, no component library |
| V. Respectful BGG Integration (v1.1.0) | ✅ | ✅ | Worker-side Cache API with TTLs, 202/429 handling, only IDs + display data stored, BGG failure never blocks the collection; 0.5 uses public website JSON only within the time-limited exception (server-side adapter, honest User-Agent, on-demand, no search engine/scraping) |
| Constraints: no committed secrets | ✅ | ✅ | BGG token and DB credentials as Wrangler secrets / Hyperdrive config; `.dev.vars` git-ignored |

## Project Structure

### Documentation (this feature)

```text
specs/001-bgg-game-collection/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── share-and-backup.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/              # pure TS, shared by app and Worker
│   ├── states.ts        # state list (extendable, FR-006)
│   ├── collection.ts    # entries, transitions, last-write-wins merge
│   ├── share.ts         # share text (contracts/share-and-backup.md)
│   ├── backup.ts        # backup serialize/validate/import plan
│   ├── geeklist-url.ts  # extract geeklist ID from pasted URL
│   └── bgg-link.ts      # game ID + suggested name from a pasted game link (FR-018)
├── app/                 # React UI only
│   ├── screens/         # Search, Geeklist, Collection, ShareBackup
│   ├── components/      # GameRow, StatePicker, StateFilter, …
│   └── main.tsx
└── client/              # browser adapters
    ├── api.ts           # fetch wrapper for /api
    ├── store.ts         # IndexedDB (entries, outbox, geeklists, meta)
    └── sync.ts          # outbox push + pull

worker/
├── index.ts             # router, static assets fallback
├── auth.ts              # Cf-Access-Jwt-Assertion validation (jose)
├── bgg/                 # BggSource interface, GeekdoSource (0.5), XmlApiSource (1.0), cache
└── db/                  # collection repository (postgres driver)

migrations/
└── 0001_collection_entry.sql

tests/
├── unit/                # domain + client (Vitest, fake-indexeddb)
├── worker/              # routes with BGG fixtures; repository on PGlite
├── fixtures/bgg/        # recorded XML responses
└── e2e/                 # Playwright, 360×740, axe
```

**Structure Decision**: Single package. `src/domain` is imported by both the SPA and the Worker, so
rules such as validation and merging exist once. `wrangler.jsonc` serves the Vite build as static
assets and routes `/api/*` to `worker/index.ts`.

## Delivery Order

| Release | Target | Scope | BGG source |
|---|---|---|---|
| 0.5 | before 2026-10-22 | US1 add by link, US2 geeklists + search in loaded geeklists, US4 at the fair, US5 share/backup, FR-021 detail completion; Access sign-in (one-time PIN), Neon storage, offline sync, PWA | public website JSON (`api.geekdo.com`), no token |
| 1.0 | when BGG approves the token | US3 search across all of BGG; adapter switched to XML API; Zitadel as Access login method | official XML API with token |

- One interface `BggSource` (`getGames(ids)`, `getGeeklistPage(id, page)`, `search(q)`) with two
  implementations: `GeekdoSource` (0.5; `search` throws "not available") and `XmlApiSource` (1.0).
  The Worker picks `XmlApiSource` when the `BGG_TOKEN` secret is set; `GET /api/me` reports
  `bggSearch: true|false`. Switching to 1.0 = deploying `XmlApiSource` and setting the secret.
- **First task of 0.5 is a spike**: call `api.geekdo.com` from a deployed Worker. Requests work
  from a home connection (checked 2026-10-16) but may be blocked from Cloudflare's network. If
  blocked, 0.5 falls back to add-by-link only, with names taken from the link (FR-018).
- 0.5 uses Cloudflare Access's email one-time PIN as login method: no extra account, no card for
  Zitadel, nothing to debug before the fair. Zitadel is added in 1.0 as an Access login method
  (dashboard configuration, no code).
- Order inside 0.5: spike → US1 → US2 → US4 → offline sync → US5. If time runs short, US5 and
  offline sync are cut first.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Server-side PostgreSQL (Neon + Hyperdrive) + sync | User asked for central storage if free; collections survive lost phones and work across devices | Browser-only storage: a lost or reset phone loses the collection; backup files rely on users remembering to export |
| Zitadel as external IdP behind Access (Release 1.0) | User explicitly wants a real IdP; individual accounts with no passwords in the app | Access one-time PIN alone is simpler; it is used for Release 0.5 and remains the fallback |
| Service worker + outbox | SC-004 requires offline use at the fair | Online-only fails on fair Wi-Fi |

## Open items for setup (not blocking tasks)

- **Schedule risk**: SPIEL Essen starts 2026-10-22; BGG token approval may take a week or more
  (R4). Apply today; without a token, search and geeklists cannot work.
- Free-tier limits verified 2026-10-16 (R1, R3). Cloudflare Zero Trust needs payment details at
  onboarding (no charge); Zitadel's credit-card requirement shows only at sign-up.
- Read BGG attribution/rate-limit terms once registered (R4).
