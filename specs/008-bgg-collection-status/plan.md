# Implementation Plan: BGG Statuses, Buy and Lists

**Branch**: `008-bgg-collection-status` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-bgg-collection-status/spec.md`, design rules
[docs/design.md](../../docs/design.md) v3.0.0, feature design [design.md](design.md), accepted ADRs
0001–0004 and 0006–0008 in [docs/adr/](../../docs/adr/README.md). Builds on features 001 (collections,
lists, swipe), 003 (menu), 006 (official BGG client, search) and 007 (Buy, prices).

## Summary

Three parts:

1. **Places**: the menu becomes Buy (tabs Search, Shopping lists), Lists (tabs Status lists,
   Previews, Geeklists) and Config. Collections are called "shopping lists" on screen; the Search
   place, the price screen, the game info sheet and the hexagon category picker go. One **game
   sheet** serves every place (badges, "in …", folded Category / BGG status / Prices).
2. **Reading statuses**: `GET /api/bgg/collection` reads a person's collection through the official
   XML API (two requests, expansions separately, 202 handled), cached 15 minutes; the device keeps
   it (IndexedDB) and cuts the eight status lists and all **badges** from it. Username and followed
   friends sync like loaded lists (two new tables).
3. **Writing statuses** (ADR 0009, Accepted): the person signs in to BGG once per device; the Worker
   keeps BGG's session only in an encrypted HttpOnly cookie on the app's origin and writes the
   person's own collection through BGG's website (statuses; after buying, Own plus price paid,
   date and "acquired from"), one tap = one write, only changed fields, never deletions.

The website endpoints for sign-in and saving are undocumented: **T001** records them with the owner
before the adapter is written (research R2, R3).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as before (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, idb, postgres, fast-xml-parser; Web Crypto (AES-GCM) in the Worker; no new dependency

**Storage**: Neon via Hyperdrive (ADR 0004): migration `0007_bgg_user.sql` adds `user_setting` and `followed_bgg_user`; IndexedDB store `bggCollections` (schema version bump) and meta `badgeColours`, `lastTab`, `bggSignedInAs`; the BGG session only in the HttpOnly cookie `bal_bgg`

**Testing**: Vitest unit (`bgg-status.ts`, `bgg-link.ts` collection links, router mapping, sync merge of settings/follows), Vitest worker (collection XML fixtures incl. 202 and unknown user; account sign-in/save/sign-out against the T001 fixtures; cookie encryption, email binding and expiry; no token on website requests, no cookie on API requests; nothing secret in logs; sync of the new rows), Playwright at 360×740 with `/api/bgg/*` faked (places and tabs, old addresses, status lists, badges, game sheet sections, sign-in, save, buy → mark as owned, price conflict, offline), axe

**Target Platform**: mobile browsers, installed PWA; Cloudflare Workers

**Project Type**: web application, one Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: status lists of 500 games visible within 10 s once BGG has prepared them (SC-001); badges from the device copy without waiting; a save confirmed within 3 s on a normal connection

**Constraints**: constitution V (+ amendment 1.4.0 from ADR 0009); BGG 1 request/s per isolate shared by reads and writes; the app token only on `/xmlapi*`; passwords and sessions never stored, cached or logged on the server; FR-012 (session device-only); WCAG 2.2 AA; design rules v3.0.0

**Scale/Scope**: 4 new routes + sync extension, 1 adapter (`account.ts`), 1 domain module, 1 migration; screens Buy (tabs), Lists (tabs), Status list, Config sections; components GameSheet (rebuilt), ListGameRow, BggBadges, StatusListCard, CategorySection, BggStatusSection, MarkOwnedSheet, SignInSheet, ColourSheet, PlaceTabs; removal of Search, Prices, GameInfoSheet, SearchResultRow (+), CategoryPicker in the sheet

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0.

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | Prototype checked at 360 px; tabs as ARIA tablist; badges always carry text, one accessible name per game ("On BoardGameGeek: …"); switches labelled by status; all actions ≥ 44 px (Add inside the row 46×52); colours from the palette with the contrast pairs of design.md §3; reduced motion respected. | ✅ |
| II. Test-First | T001 records real traffic as fixtures before the adapter; domain, router and worker tests before code; e2e per story against faked routes. | ✅ |
| III. Domain Logic Separate | Statuses, badge order, status lists, diffing, collection links and the "in …" text are pure functions in `src/domain/`; the Worker adapter only maps BGG requests; UI renders and forwards. | ✅ |
| IV. Simplicity (YAGNI) | One read per person (not eight); statuses cached on the device, not in the database; no new dependency; the price screen, Search place and info sheet are removed rather than kept beside the new sheet. | ✅ |
| V. Respectful BoardGameGeek Integration | Reading: official API with the token, cached, on demand, 202 waits client-side with growing pauses. Writing with the person's own session follows V's rule for writing (amendment 1.4.0, ADR 0009 accepted 2026-11-08): per tap, session device-only and encrypted, nothing on the server, one adapter, no token with sessions. | ✅ |

**Post-design re-check**: all ✅ against constitution v1.4.0 (amended 2026-11-08 with ADR 0009).

## Project Structure

### Documentation (this feature)

```text
specs/008-bgg-collection-status/
├── spec.md, design.md, design/prototype.html, checklists/requirements.md
├── plan.md, research.md (R1–R9), data-model.md, quickstart.md
├── contracts/api.md, contracts/ui.md
└── tasks.md                     # /speckit-tasks
docs/adr/0009-writing-to-a-persons-bgg-collection.md   # NEW (Accepted 2026-11-08)
.specify/memory/constitution.md  # amended to 1.4.0 (writing rule under V)
```

### Source Code (repository root)

```text
migrations/
└── 0007_bgg_user.sql            # NEW user_setting, followed_bgg_user (+ synced_at indexes)
worker/
├── bgg/
│   ├── cache.ts                 # token only on /xmlapi* (R5); `bgg_preparing` for collections
│   ├── official.ts              # getCollection(user): two requests, expansions separately → items with status
│   ├── account.ts               # NEW website sign-in, item read, save (statuses, private info); fixtures from T001
│   └── session.ts               # NEW AES-GCM cookie: seal/open, email binding, expiry, Set-Cookie strings
├── routes/
│   ├── collection.ts            # NEW GET /api/bgg/collection
│   ├── account.ts               # NEW GET /api/bgg/account, POST …/signin, …/signout, …/collection/<bggId>
│   └── sync.ts                  # settings, follows
├── db/repository.ts             # read/write user_setting, followed_bgg_user
└── index.ts                     # routes; Env.BGG_SESSION_KEY; no body/cookie logging on account routes
src/domain/
├── bgg-status.ts                # NEW Status, StatusKey, badge order and labels, statusList, diff, priority names
├── bgg-link.ts                  # + parseBggCollectionLink
└── membership.ts                # + inText ("in X", "in X and Y", "in n shopping lists", "also in …")
src/client/
├── api.ts                       # bggCollection, account, signIn, signOut, saveStatus
├── store.ts                     # store bggCollections; meta badgeColours, lastTab, bggSignedInAs; settings/follows in outbox
└── sync.ts                      # settings, follows
src/app/
├── router.ts                    # new routes and old-address mapping (contracts/ui.md)
├── components/Menu.tsx          # Buy, Lists, Config
├── components/PlaceTabs.tsx     # NEW
├── components/BggBadges.tsx     # NEW (+ theme/badges.css palette)
├── components/ListGameRow.tsx   # NEW (replaces SearchResultRow's + and the list row's +)
├── components/StatusListCard.tsx            # NEW
├── components/GameSheet.tsx     # rebuilt: head, Category/BGG status/Prices sections, actions per context
├── components/CategorySection.tsx, BggStatusSection.tsx, MarkOwnedSheet.tsx, SignInSheet.tsx, ColourSheet.tsx  # NEW
├── components/GameRow.tsx, BuySheet.tsx, FilterPanel.tsx   # badges; mark-as-owned after Got it; BGG status segment
├── hooks/useBggCollection.ts    # NEW load, 1-hour freshness, 202 retry with growing pauses, badges map
├── screens/Buy.tsx              # tabs Search | Shopping lists (Collections.tsx content)
├── screens/Lists.tsx            # tabs Status lists | Previews | Geeklists
├── screens/StatusList.tsx       # NEW
├── screens/Config.tsx           # BoardGameGeek (username, sign-in), Badge colours
├── screens/Search.tsx, screens/Prices.tsx, components/GameInfoSheet.tsx   # REMOVED
└── (all visible "collection" texts → "shopping list")
tests/
├── fixtures/bgg-xml/collection-*.xml, fixtures/bgg-web/*   # NEW
├── unit/bgg-status.test.ts, unit/bgg-link.test.ts, unit/router.test.ts, unit/membership.test.ts
├── worker/bgg-collection.test.ts, worker/bgg-account.test.ts, worker/bgg-session.test.ts, worker/sync*.test.ts
└── e2e/places.spec.ts, status-lists.spec.ts, bgg-status.spec.ts, buy-owned.spec.ts (+ existing specs updated for the new places and words)
```

**Structure Decision**: the website writes get their own adapter and session module inside
`worker/bgg/`, beside the read sources, so ADR 0009's confinement is visible in the tree; the UI
consolidates on one game sheet instead of adding a third.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Writing through BGG's website with the person's session (constitution V not covering it) | the owner wants to change BGG where they decide (spec US4, US5); BGG has no write API | "Edit on BGG" link: rejected by the owner; a shared account would write the wrong collection |
| Encrypted HttpOnly cookie + new secret | keeps the session device-only and out of scripts, logs and the database (FR-011–FR-013) | `localStorage`: readable by any script on the origin; database: violates FR-012 |
| Two new synced tables | username and followed friends follow the person to other devices (FR-001, like loaded lists) | device-only: a second phone would start empty, unlike every other list |
| Navigation rework in the same feature | status lists need their home; the owner asked for Buy/Lists (spec US0) | a separate feature would build the status lists into a place that is about to go |
