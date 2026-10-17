# Implementation Plan: BGG Game Collection

**Branch**: `001-bgg-game-collection` | **Date**: 2026-10-17 (re-planned after the design session) | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-bgg-game-collection/spec.md`, design rules
[docs/design.md](../../docs/design.md) v1.0.1, feature design [design.md](design.md), accepted ADRs
0001–0006 in [docs/adr/](../../docs/adr/README.md).

## Summary

A mobile-first web app in which each person keeps several collections (Essen or standard) of
BoardGameGeek games, fills them from BGG lists by swiping or ticking, marks games (Must Have,
Interested, Unsure, Poop, Not interested), ticks them off as bought with the price paid, and shares
them as text. One Cloudflare Worker serves the React SPA and a small `/api` (ADR 0002): a cached BGG
proxy and per-user storage of collections in Neon PostgreSQL via Hyperdrive (ADR 0004). Cloudflare
Access keeps everyone but invited friends out (ADR 0003). The app is local-first: IndexedDB plus an
outbox keep everything usable offline.

**Key finding of this re-plan (R9)**: on BoardGameGeek, SPIEL Essen 2026 is a **GeekPreview**
(no. 93, ~1,376 games), not a geeklist. Previews carry structured booth (e.g. "3-R400"), show
price, MSRP, availability and publisher per game; geeklists only have free text. The app therefore
loads two kinds of BGG lists: **previews**, which are Essen lists with facts, and **geeklists**,
which have no facts. The spec says "load a BGG list"; the kind follows from the link.

## Technical Context

**Language/Version**: TypeScript 5.x; Node.js 22 LTS for tooling

**Primary Dependencies**: React 19, Vite, vite-plugin-pwa, idb (app); Wrangler, `postgres` driver,
`jose`, `fast-xml-parser` for Release 1.0 (Worker), per ADR 0006

**Storage**: Neon PostgreSQL via Hyperdrive (collections, entries, shared game cache); IndexedDB on
the device (mirror, outbox, loaded lists), per ADR 0004

**Testing**: Vitest, @cloudflare/vitest-pool-workers, PGlite, Playwright + @axe-core/playwright

**Target Platform**: current mobile Safari and Chrome; Cloudflare Workers runtime

**Project Type**: web application (SPA + edge API in one Worker)

**Performance Goals**: first list games < 10 s (SC-002); add by link and mark < 20 s (SC-001);
≥ 15 swipe decisions per minute (SC-011); marks in ≤ 2 taps (SC-003)

**Constraints**: offline-capable (SC-004); 360 px, WCAG 2.2 AA, docs/design.md (FR-024); free tiers;
BGG token never in the client; BGG requests cached and throttled (FR-025); reduced motion respected

**Scale/Scope**: < 10 users; a few collections each, a few hundred entries per collection; lists up
to ~1,500 games; about 12 screens and sheets (design.md)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0.

| Principle | Pre | Post | How the design complies |
|---|---|---|---|
| I. Mobile-First & Accessible | ✅ | ✅ | design.md tokens and components; Playwright at 360 px with axe; reduced motion switches off animations, the background and tap pulses |
| II. Test-First | ✅ | ✅ | domain (marks, merge, filter, facts rule, share text, backup) unit-tested first; Worker against recorded BGG JSON fixtures; repository on PGlite |
| III. Logic separate from UI | ✅ | ✅ | `src/domain/` pure TS; BGG, database, IndexedDB, sound and vibration behind interfaces with fakes |
| IV. Simplicity (YAGNI) | ✅ | ✅ | no roles, no social features, no component library; sound synthesised (no assets); Complexity Tracking below |
| V. Respectful BGG Integration (incl. time-limited exception) | ✅ | ✅ | server-side adapter (ADR 0005), Cache API, list loading throttled to 1 request/s, honest User-Agent, no scraping or search engines; only IDs, display data and preview facts stored |
| Constraint: UI follows docs/design.md | ✅ | ✅ | design tokens become CSS custom properties 1:1; components named as in design.md §7 |
| Constraint: no committed secrets | ✅ | ✅ | BGG token and DB credentials as Wrangler secrets / Hyperdrive config |

ADR check (extension 1): accepted ADRs 0002–0006 apply unchanged; no new project-wide decision arose.
The preview/geeklist distinction is feature-level (research R9).

## Project Structure

### Documentation (this feature)

```text
specs/001-bgg-game-collection/
├── spec.md, design.md, design/prototype.html
├── plan.md              # this file
├── research.md          # R1–R13
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md
│   └── share-and-backup.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/                  # pure TS, shared by app and Worker
│   ├── marks.ts             # marks, order, groups (FR-004/005)
│   ├── collection.ts        # entries, bought/paid, merge (last write wins)
│   ├── filter.ts            # groups × bought filter, presets (FR-009)
│   ├── facts.ts             # Essen facts rule, manual facts (FR-010/011)
│   ├── lists.ts             # BGG list references from links: preview / geeklist (FR-012)
│   ├── membership.ts        # collection ticks before/after → adds and removals (FR-014)
│   ├── swipe.ts             # swipe queue and decisions (FR-015)
│   ├── bgg-link.ts          # game ID + suggested name from a link (FR-016)
│   ├── share.ts             # share text (contracts/share-and-backup.md)
│   └── backup.ts            # backup v2: serialise, validate, import plan
├── app/                     # React UI, follows docs/design.md
│   ├── theme/               # tokens.css, hexagon helpers, motion (reduced-motion aware)
│   ├── screens/             # Collections, Collection, Swipe, Lists, List, Add, Search, Share, Intro
│   ├── components/          # CollectionCard, GameRow, GroupHeading, FilterPanel, HexPicker,
│   │                        # MultiChoice, SwipeCard, Sheet, Toast, HexBoard (background) …
│   └── main.tsx
└── client/                  # browser adapters
    ├── api.ts               # fetch wrapper for /api
    ├── store.ts             # IndexedDB: collections, entries, outbox, lists, games, meta
    ├── sync.ts              # outbox push + pull
    ├── lists.ts             # background list loader, publishers filled in afterwards
    ├── details.ts           # completes link-added games (FR-017)
    └── feedback.ts          # dice sound (Web Audio), vibration, mute setting

worker/
├── index.ts                 # router, static assets fallback
├── auth.ts                  # Cf-Access-Jwt-Assertion validation (jose)
├── routes/                  # sync, games, lists, companies, search
├── bgg/                     # BggSource interface; GeekdoSource (0.5), XmlApiSource (1.0); cache
└── db/                      # collections and entries repository; game cache

migrations/
└── 0001_collections.sql

tests/
├── unit/                    # domain + client (Vitest, fake-indexeddb)
├── worker/                  # routes with BGG fixtures; repository on PGlite
├── fixtures/bgg/            # recorded geekdo JSON: preview 93 pages, a geeklist page, geekitems
└── e2e/                     # Playwright 360×740, axe, a reduced-motion run
```

**Structure Decision**: single package (ADR 0006). The prototype is a visual reference only; no
code is copied from it.

## Delivery Order

| Release | Target | Scope | BGG source |
|---|---|---|---|
| 0.5 | before 2026-10-22 | US1–US5: collections, marks, add by link, previews and geeklists, swipe, bought/price/filter/facts, share/backup, offline, intro, sound | public website JSON (`api.geekdo.com`) under the constitution V exception |
| 1.0 | BGG token granted | US6 search; adapter switched to the XML API; Zitadel as Access login method | official XML API |

Order inside 0.5 (cut from the end if time runs short):
1. Spike: `api.geekdo.com` reachable from a deployed Worker (preview items, geekitems).
2. Foundation: Worker + Access check, Neon schema, BGG adapter, IndexedDB store + outbox, app shell
   with design tokens, tab bar and sheets.
3. US1 collections, marks, add by link → US2 lists (preview 93 first) → US3 swipe → US4 bought,
   price, filter, facts → US5 share and backup.
4. Delight last: hexagon background, burst, stamp, sound, vibration, intro.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Server PostgreSQL + sync (ADR 0004) | collections survive lost phones, multi-device | browser-only: a lost phone loses everything |
| Two BGG list kinds (preview + geeklist) | SPIEL is a preview with structured facts; friends' lists are geeklists | geeklists only: no booth or price for Essen |
| Shared game cache table | cover, year and description reused across users and collections | per-entry copies: many more BGG requests |
| Synthesised sound + vibration | design rule §10, cheap without assets | audio files: bundle weight, licensing |

## Open points

- Apply for the BGG XML API token (approval may take a week or more).
- Loading the whole SPIEL preview takes ~2–3 minutes at 1 request/s (138 pages of 10); the first
  page shows at once and the rest loads in the background (R9). Opening a list counts as the
  user's request for the whole list; pages load only while the list is open or the app is in the
  foreground (constitution V, "on user demand").
