# Tasks: BGG Game Collection

**Input**: Design documents from `/specs/001-bgg-game-collection/`
**Prerequisites**: plan.md, spec.md, design.md, research.md, data-model.md, contracts/, quickstart.md;
design rules `docs/design.md` v1.0.1; ADRs 0001–0006.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before
the code it covers and must fail first. BGG is only ever tested against recorded fixtures.

**Organization**: by user story (spec.md US1–US6), so each story can be built, tested and shown on
its own. Release 0.5 = Phases 1–7 and 9 plus T066; Release 1.0 adds T067–T070.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US6)

## Path Conventions

Single package (plan.md): `src/domain/`, `src/app/`, `src/client/`, `worker/`, `migrations/`,
`tests/{unit,worker,e2e,fixtures}/`.

---

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Initialise the package: `package.json` (scripts `dev`, `test`, `test:e2e`, `db:migrate`, `deploy`), `tsconfig.json` (strict), `.gitignore` (`node_modules`, `dist`, `.dev.vars`)
- [ ] T002 [P] Create the Vite + React 19 app entry `index.html`, `src/app/main.tsx`, `vite.config.ts` with `vite-plugin-pwa` (app shell and fonts precached)
- [ ] T003 [P] Create `wrangler.jsonc`: static assets from `dist`, `/api/*` → `worker/index.ts`, Hyperdrive binding `HYPERDRIVE`, vars `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ENVIRONMENT`; add `.dev.vars.example` (`DEV_USER_EMAIL`, `DATABASE_URL`, optional `BGG_TOKEN`)
- [ ] T004 [P] Configure tests: `vitest.config.ts` (projects: unit with fake-indexeddb, worker with `@cloudflare/vitest-pool-workers`), `playwright.config.ts` (viewport 360×740, a second project with `reducedMotion: 'reduce'`, `@axe-core/playwright`)
- [ ] T005 [P] Self-host fonts Chakra Petch (500/600/700) and Manrope (400–700) in `src/app/theme/fonts/` with `@font-face` in `src/app/theme/fonts.css` (research R13: no third-party font requests)
- [ ] T006 Spike (decision gate, research R9/R4a): temporary route `GET /api/_spike` in `worker/spike.ts` that fetches `api.geekdo.com/api/geekpreviewitems?previewid=93&pageid=1` and `api/geekitems?objectid=295947&objecttype=thing` with an honest User-Agent; deploy, record the result in `specs/001-bgg-game-collection/research.md` (R9 "Spike result"), then delete the route. If blocked from Cloudflare: lists fall back to add-by-link only (note in plan.md)

**Checkpoint**: project builds, empty tests run, BGG reachability decided.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ No user story starts before this phase is complete.**

### Tests first

- [ ] T007 [P] Unit tests for marks in `tests/unit/marks.test.ts`: order `new, must_have, interested, unsure, poop, skip`, labels and emoji per data-model.md, unknown keys rejected
- [ ] T008 [P] Unit tests for entries and merge in `tests/unit/collection.test.ts`: later `updatedAt` wins, equal → server copy, tombstones (`deleted = true`) sync like changes, collection `name` "1–60 chars, trimmed", `type` "`essen` | `standard`", renaming keeps the type, deleting a collection tombstones all its entries (FR-001a)
- [ ] T009 [P] Worker tests for auth in `tests/worker/auth.test.ts`: valid `Cf-Access-Jwt-Assertion` (JWKS, `aud`, `exp`) passes; missing/invalid → `401 {"error":"unauthenticated"}`; `DEV_USER_EMAIL` used only when `ENVIRONMENT=development`
- [ ] T010 [P] Repository tests on PGlite in `tests/worker/db.test.ts`: schema from `migrations/0001_collections.sql`, upsert applies last-write-wins, every query limited to the caller's `user_email`, CHECKs (`length(name) BETWEEN 1 AND 60`, `type IN ('essen','standard')`, `bgg_id > 0`, `paid_cents >= 0`, `paid_currency` a 3-letter code or null, null whenever `paid_cents` is null)
- [ ] T011 [P] Unit tests for the browser store in `tests/unit/store.test.ts` (fake-indexeddb): stores `collections`, `entries` (key `[collectionId, bggId]`), `outbox`, `games`, `lists`, `publishers`, `meta`; outbox enqueue and acknowledge
- [ ] T012 [P] Worker tests for sync in `tests/worker/sync.test.ts` per contracts/api.md: `GET /api/sync?since=`, `POST /api/sync` (1–500 items, mark known, `bggId > 0`, `updatedAt` ≤ 5 min in the future, entry's collection must belong to the user, `paidCurrency` a 3-letter code or null), `{ applied, ignored }`, idempotent
- [ ] T012a [P] BGG adapter tests in `tests/worker/bgg-cache.test.ts` (fake clock, fixtures): cache times lists 1 h, games 7 days, companies 30 days; a repeated request is served from the cache; at most 1 request/s to BGG; honest `User-Agent`; BGG failure → `bgg_unavailable`, 429 → `bgg_rate_limited` (FR-025, constitution V)
- [ ] T012b [P] Unit tests for the client in `tests/unit/sync-client.test.ts` (fake fetch, fake-indexeddb): outbox pushed then acknowledged; pull with `since` merges last-write-wins; after a network error the outbox stays filled and is retried on `online`; API errors mapped to the error codes of contracts/api.md

### Implementation

- [ ] T013 [P] Implement marks in `src/domain/marks.ts` (list, order, labels, emoji, `isMark`)
- [ ] T014 Implement collection and entry types plus merge in `src/domain/collection.ts` (fields exactly as data-model.md)
- [ ] T015 Write `migrations/0001_collections.sql` with tables `collection`, `collection_entry`, `game` and indexes exactly as data-model.md; add `scripts/migrate.ts` behind `npm run db:migrate`
- [ ] T016 Implement Access JWT validation in `worker/auth.ts` with `jose` (JWKS from `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, cached)
- [ ] T017 Implement the repository in `worker/db/repository.ts` (`postgres` driver over Hyperdrive; collections, entries, game cache; SQL last-write-wins)
- [ ] T018 Implement the router, error format and `GET /api/me` in `worker/index.ts` (error codes from contracts/api.md; `bggSearch` false until `BGG_TOKEN` is set)
- [ ] T019 Implement `GET/POST /api/sync` in `worker/routes/sync.ts`
- [ ] T020 [P] Define `BggSource` (`getGames`, `getListPage`, `search`) and the edge cache + 1 request/s throttle in `worker/bgg/source.ts` and `worker/bgg/cache.ts` (constitution V)
- [ ] T021 Implement IndexedDB access in `src/client/store.ts` (one database per signed-in email, `board-a-licious-<email>`; `introSeen` kept in a device-wide key)
- [ ] T022 Implement `src/client/api.ts` (fetch wrapper, error mapping) and `src/client/sync.ts` (push outbox, pull `since`; on start, on `online`, after each change)
- [ ] T023 [P] Translate design tokens into `src/app/theme/tokens.css` (colours, gradients, radii, `--lift`, hexagon `clip-path`) and base styles in `src/app/theme/base.css` per docs/design.md §3–§6
- [ ] T024 [P] Implement interaction states in `src/app/theme/interaction.css` (hover: no movement, orange border + outer glow, outlined buttons fill orange; press squish; focus outline) and the tap pulse in `src/app/components/TapPulse.tsx` per docs/design.md §8
- [ ] T025 Build the app shell in `src/app/App.tsx` with `src/app/components/{TabBar,Header,Sheet,Toast}.tsx`: tabs Collections, Lists, + (hexagon, shimmer), Search, Share; header with back button and sound toggle slot

**Checkpoint**: signed-in user, empty app shell, sync round-trip works offline and online.

---

## Phase 3: User Story 1 - Collections and marking games (Priority: P1) 🎯 MVP

**Goal**: create collections, add games by link, mark them; grouped collection view.
**Independent Test**: spec US1 — create an Essen collection, add a game by link, mark it, reload, all still there.

### Tests for User Story 1

- [ ] T026 [P] [US1] Unit tests for links in `tests/unit/bgg-link.test.ts`: `/boardgame/<id>[/<slug>]` and `/boardgameexpansion/…`, suggested name from slug (`ark-nova` → "Ark Nova"), non-game links rejected with a hint
- [ ] T027 [P] [US1] Worker tests for game details in `tests/worker/bgg-games.test.ts` with fixture `tests/fixtures/bgg/geekitems-295947.json`: name, year, thumbnail, `short_description`; `GET /api/bgg/games?ids=` (1–50 IDs) served from the `game` table when fresher than 7 days
- [ ] T027a [P] [US1] Unit tests in `tests/unit/details.test.ts`: an entry with `detailsPending` gets name, year, cover and description; mark, bought and price stay unchanged; a BGG failure keeps it pending for the next try (FR-017)
- [ ] T028 [P] [US1] End-to-end test in `tests/e2e/us1-collections.spec.ts`: create "Essen 2026" (Essen on), empty state with both buttons, add by link, mark Must Have, reload; axe clean at 360 px

### Implementation for User Story 1

- [ ] T029 [P] [US1] Implement `src/domain/bgg-link.ts`
- [ ] T030 [US1] Implement `GeekdoSource.getGames` in `worker/bgg/geekdo.ts` and `GET /api/bgg/games` in `worker/routes/games.ts`
- [ ] T031 [P] [US1] Build `src/app/components/HexCover.tsx` (cover in a hexagon, initials while `detailsPending` or without cover) and `src/app/components/HexPicker.tsx` (honeycomb of 3–4 hexagons, docs/design.md §7)
- [ ] T032 [US1] Build the Collections screen `src/app/screens/Collections.tsx` with `src/app/components/CollectionCard.tsx` (Essen badge, counts per mark and bought, top-right hexagon cluster, "Create a collection" card)
- [ ] T033 [US1] Build the Add screen `src/app/screens/Add.tsx`: hexagons Collection / BGG list / Game; New collection form (name, "Essen collection" switch on by default, "Create collection" disabled until a name is typed)
- [ ] T034 [US1] Build the Collection screen `src/app/screens/Collection.tsx` with `GameRow.tsx` and `GroupHeading.tsx`: groups in mark order, "Not yet marked" first, "Not interested" collapsed; centred empty state with "Add from BGG list" and "Add by link"; separator line
- [ ] T035 [US1] Build the game details sheet `src/app/components/GameSheet.tsx`: cover, name, year, BGG link, mark picker (4 hexagons), "🛑 Not interested" / "Mark as not yet decided", "Remove from collection"
- [ ] T036 [US1] Build add-by-link inside a collection `src/app/screens/AddByLink.tsx` (link only, "Add to ‹collection›", back to the collection) and the Game form in `Add.tsx` (collection dropdown always visible, "Add game" enabled only with a valid link, a name and a free collection; with no collection yet, offer "Create a collection" first — name prefilled "SPIEL 2026", Essen — and then continue with the game, FR-016)
- [ ] T037 [US1] Complete link-added games in the background in `src/client/details.ts` (FR-017: fetch details for `detailsPending` entries, keep marks)
- [ ] T037a [US1] Rename and delete a collection from a header menu in `src/app/screens/Collection.tsx` (rename: 1–60 chars; delete: confirmation "Delete ‹name› and its N games?", tombstones the collection and all its entries via the outbox; type stays fixed) and the rules in `src/domain/collection.ts`, covered by T008 (FR-001a)
- [ ] T038 [US1] Build the switched-off Search screen `src/app/screens/Search.tsx` ("Searching all of BoardGameGeek comes soon", disabled field, "Add a game by link instead") — FR-019 for Release 0.5

**Checkpoint**: US1 works on its own (MVP).

---

## Phase 4: User Story 2 - Load BGG lists and put their games into collections (Priority: P2)

**Goal**: load previews (Essen, with facts) and geeklists by link, browse, put games into collections.
**Independent Test**: spec US2 — load the SPIEL preview, tick an Essen and a standard collection for a game, Done; facts only in the Essen one.

### Tests for User Story 2

- [ ] T039 [P] [US2] Unit tests in `tests/unit/lists.test.ts`: `/geekpreview/<id>…` → `{kind: 'preview', id}`, `/geeklist/<id>…` → `{kind: 'geeklist', id}`, anything else → null
- [ ] T040 [P] [US2] Unit tests in `tests/unit/facts.test.ts`: facts kept only for preview → Essen collection; reason texts for every other combination; manual facts marked `factsSource: 'manual'`
- [ ] T041 [P] [US2] Unit tests in `tests/unit/membership.test.ts`: before/after sets → adds and removals; removal = tombstone incl. mark, bought and price
- [ ] T042 [P] [US2] Worker tests in `tests/worker/bgg-lists.test.ts` with fixtures `tests/fixtures/bgg/preview-93-page-1.json`, `preview-93-page-138.json`, `geeklist-page-1.json`, `company-34183.json`: preview entries carry booth (`location`), price (`showprice`, else `msrp`, with currency) and `publisherId`; page 1 responds without company lookups (`publisher` null when not cached); `GET /api/bgg/companies?ids=` (1–10 IDs) returns names; geeklist entries have no facts and skip non-games; `pageCount`; 404 for unknown lists
- [ ] T042a [P] [US2] Unit tests in `tests/unit/list-loader.test.ts` (fake clock, fake API): page 1 at once, the rest sequentially at ≤ 1 request/s; progress stored; resumes after a reload; pauses when the list is closed or the app is in the background; stops with a retryable error when a page fails; missing publishers resolved afterwards; preview facts in collections updated on reload, manual facts untouched
- [ ] T043 [US2] End-to-end test in `tests/e2e/us2-lists.spec.ts`: load preview link, Essen badge, first page fast, progress, name filter, membership ticks applied on Done, Cancel discards

### Implementation for User Story 2

- [ ] T044 [P] [US2] Implement `src/domain/lists.ts`, `src/domain/facts.ts` and `src/domain/membership.ts`
- [ ] T045 [US2] Implement `GeekdoSource.getListPage` in `worker/bgg/geekdo.ts` (preview items returned without waiting for publisher names, `publisher` from the company cache or null; geeklist items), `GET /api/bgg/lists/:kind/:id?page=` in `worker/routes/lists.ts` and `GET /api/bgg/companies?ids=` in `worker/routes/companies.ts` per contracts/api.md
- [ ] T046 [US2] Implement the background list loader in `src/client/lists.ts` (page 1 at once, remaining pages sequentially at ≤ 1 request/s, progress stored in `lists`, resumable after reload; loads only while the list is open or the app is in the foreground — constitution V "on user demand"; then resolves missing publishers via `/api/bgg/companies` and updates the stored entries; on a reload after 1 h, updates booth and price of collection entries with `factsSource: 'preview'`, never `manual`; a failed page pauses with "BoardGameGeek is not reachable. Retry")
- [ ] T047 [US2] Build the BGG list form in `src/app/screens/Add.tsx` (link field, hint "Preview: an Essen list …" / "Geeklist: …", "Load list" disabled until a valid link)
- [ ] T048 [US2] Build `src/app/screens/Lists.tsx` (cards with Essen badge and progress, "Load a BGG list" card) and `src/app/screens/List.tsx` (name filter, rows with facts and "in a collection", + per row)
- [ ] T049 [US2] Build `src/app/components/MembershipSheet.tsx` (cover, description, facts, one hexagon tick per collection showing current membership and the effect of a change; Done / Cancel)

**Checkpoint**: US1 + US2 work independently.

---

## Phase 5: User Story 3 - Swipe through a BGG list (Priority: P3)

**Goal**: card-by-card decisions from a list into a collection.
**Independent Test**: spec US3 — swipe ten games; right → Not yet marked, left → Not interested, none offered again.

### Tests for User Story 3

- [ ] T050 [P] [US3] Unit tests in `tests/unit/swipe.test.ts`: queue in list order starting at the first undecided game, without games already in the collection (incl. `skip`); right → `mark = new`; left → `mark = skip`; works while pages are still loading
- [ ] T051 [US3] End-to-end test in `tests/e2e/us3-swipe.spec.ts`: drag, ✓/✕ buttons, arrow keys, "all decided" message; screen reader announces the card and the decision

### Implementation for User Story 3

- [ ] T052 [P] [US3] Implement `src/domain/swipe.ts`
- [ ] T053 [US3] Build the list picker sheet and `src/app/screens/Swipe.tsx` with `src/app/components/SwipeCard.tsx`: cover, name, year, description (3 lines), facts or "No booth or price on this list", source note with the facts rule, "Loading more games…" card while pages load, drag with tilt and growing ADD/NOPE stamps, spring back, fling, next card pops in, `aria-live` announcement

**Checkpoint**: US1–US3 work independently.

---

## Phase 6: User Story 4 - Use a collection at the fair (Priority: P4)

**Goal**: bought with price, filter, money spent, manual facts, game descriptions.
**Independent Test**: spec US4 — preset "Must Have, not bought", buy a game at a price, check view, badge and total.

### Tests for User Story 4

- [ ] T054 [P] [US4] Unit tests in `tests/unit/filter.test.ts`: groups × bought (`all` / `no` / `yes`), presets `all` and `hunt` = `{ groups: {must_have}, bought: 'no' }`, label text for the filter button; price parsing (`52`, `12,50`, `12.50` → cents) and display ("€52", "€12.50")
- [ ] T055 [P] [US4] Unit tests in `tests/unit/bought.test.ts`: suggested price from `facts.priceCents`, skip price, currency from `facts.currency`, else `EUR`; undo clears `paidCents` and `paidCurrency`; spent = sum of `paidCents` of bought entries per currency ("€152 + $40") (FR-008)
- [ ] T056 [US4] End-to-end test in `tests/e2e/us4-fair.spec.ts`: filter panel, preset, "Bought it" with price, badge "✅ €52", "€52 spent", game stays in its group, manual facts "Added by you"

### Implementation for User Story 4

- [ ] T057 [P] [US4] Implement `src/domain/filter.ts` and the bought rules in `src/domain/collection.ts`
- [ ] T058 [US4] Build `src/app/components/FilterPanel.tsx` (button with selection and count; presets; Bought segment; group checkboxes with counts; closes on Done or outside tap; selection stored per collection in `meta.activeFilter`)
- [ ] T059 [US4] Extend `GameSheet.tsx`: "✅ Bought it" → "What did you pay?" (prefilled, comma or point, 0–9,999, Enter saves, "Don't track the price"), "Not bought after all"; bought ✓ on the cover and price badge in `GameRow.tsx`; bought line under the filter in `Collection.tsx` with the money spent per currency
- [ ] T060 [US4] Add manual facts to `GameSheet.tsx`: "➕ Add booth, price and publisher" / "✎ Edit", form with Booth, Price with a currency choice (default EUR), Publisher, Save enabled once one field is filled (FR-011)
- [ ] T061 [US4] Show the game description in `GameSheet.tsx` and `MembershipSheet.tsx`, with "The description is filled in from BoardGameGeek later." when missing (FR-018)

**Checkpoint**: US1–US4 work independently.

---

## Phase 7: User Story 5 - Share, back up and restore (Priority: P5)

**Goal**: share one collection as text; export/import all collections.
**Independent Test**: spec US5 — share to a chat; export, delete a collection, import, unchanged.

### Tests for User Story 5

- [ ] T062 [P] [US5] Unit tests in `tests/unit/share.test.ts` per contracts/share-and-backup.md: default groups Must Have and Interested, Not yet marked selectable, groups in mark order, names sorted, ✅ for bought, booth and price for Essen, full URLs, empty selection not shareable
- [ ] T063 [P] [US5] Unit tests in `tests/unit/backup.test.ts`: version 2 round trip, version 1 imported as standard collection "Imported", invalid files rejected without changes, conflict choice "Keep current" / "Use backup"

### Implementation for User Story 5

- [ ] T064 [P] [US5] Implement `src/domain/share.ts` and `src/domain/backup.ts`
- [ ] T065 [US5] Build `src/app/screens/Share.tsx`: collection choice, group checkboxes with counts, message preview, "Share list" (Web Share API, clipboard fallback), Export / Import with conflict dialog; end-to-end test in `tests/e2e/us5-share.spec.ts`

**Checkpoint**: Release 0.5 features complete except polish.

---

## Phase 8: User Story 6 - Search all of BoardGameGeek (Priority: P6, Release 1.0)

**Goal**: official XML API with token; search.
**Independent Test**: spec US6 — with a token, search "Cascadia" and add it.

- [ ] T066 [US6] Keep the 0.5 Search screen (T038) wired to `GET /api/me` `bggSearch`; ship 0.5 with it switched off
- [ ] T067 [P] [US6] Worker tests in `tests/worker/bgg-xml.test.ts` with recorded XML fixtures (`search`, `thing`, geeklist): mapping to `Game`, 202/429 handling
- [ ] T068 [US6] Implement `worker/bgg/xmlapi.ts` (`XmlApiSource`, `fast-xml-parser`, `Authorization: Bearer <BGG_TOKEN>`), selected in `worker/bgg/source.ts` when `BGG_TOKEN` is set; previews stay on `GeekdoSource` (research R9)
- [ ] T069 [US6] Implement `GET /api/bgg/search` in `worker/routes/search.ts` (`q` 2–100 chars, max 50 results)
- [ ] T070 [US6] Enable search results in `src/app/screens/Search.tsx` (results with cover and year, add to a collection via the dropdown)

---

## Phase 9: Polish & Cross-Cutting Concerns (part of Release 0.5)

- [ ] T071 [P] Build the animated hexagon background `src/app/components/HexBoard.tsx` (canvas, faint honeycomb, light waves, popping cells, brightest at the top, ~30 fps, paused when hidden, still frame with reduced motion) per docs/design.md §9
- [ ] T072 [P] Build `src/app/components/Celebrate.tsx`: Must Have burst (~20 hexagons) and "GOT IT!" stamp; rolling counters `src/app/components/Counter.tsx`
- [ ] T073 [P] Unit tests then implementation of `src/client/feedback.ts` (dice sound and chime via Web Audio, vibration via `navigator.vibrate`, mute stored in `meta.soundOn`) with fakes in `tests/unit/feedback.test.ts`; wire the header sound toggle
- [ ] T074 [P] Build the intro `src/app/screens/Intro.tsx` (3 swipeable cards, Skip, Next / "Let's go", `meta.introSeen`, "Show the intro again" on the Collections screen) — FR-027; end-to-end check in `tests/e2e/intro.spec.ts`: shown on first start, Skip lands on Collections, not shown after a reload, "Show the intro again" brings it back
- [ ] T075 Offline: precache app shell, fonts and loaded data; end-to-end test `tests/e2e/offline.spec.ts` (airplane mode: mark, buy, reload; online: synced) — SC-004
- [ ] T076 Accessibility and reduced-motion pass over all screens at 360×740 in `tests/e2e/a11y.spec.ts` (axe, no horizontal scroll, focus order, labels) — FR-024, FR-026, SC-006
- [ ] T077 Production setup: Neon migration, Hyperdrive, Access application (one-time PIN), secrets; setup steps in `README.md`
- [ ] T078 Run the 19 validation scenarios of `quickstart.md` on the deployed app (phone), note results in `specs/001-bgg-game-collection/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (1) → Foundational (2) → user stories (3–7) → Polish (9). T006 (spike) decides whether US2/US3 use BGG lists or fall back.
- US6 (8) needs the BGG token; it can happen any time after Phase 2.

### User Story Dependencies

- **US1** (P1): only Foundational.
- **US2** (P2): Foundational; uses US1's collections and `GameSheet` patterns but is testable on its own.
- **US3** (P3): needs US2's lists (T045, T046).
- **US4** (P4): needs US1 (collection screen, game sheet).
- **US5** (P5): needs US1 data; independent of US2–US4.
- **US6** (P6): needs Phase 2 and the token.

### Within Each User Story

- Tests first, failing → domain → Worker → client → UI → end-to-end test passes.

### Parallel Opportunities

- Setup T002–T005; Foundational tests T007–T012b and T013, T020, T023, T024.
- Within stories: all test tasks marked [P]; domain modules ([P]) while Worker routes are built.
- US4 and US5 can run in parallel after US1; Polish T071–T074 in parallel at any point after Phase 2.

---

## Parallel Example: User Story 2

```bash
# Tests together:
Task: "T039 tests/unit/lists.test.ts"
Task: "T040 tests/unit/facts.test.ts"
Task: "T041 tests/unit/membership.test.ts"
Task: "T042 tests/worker/bgg-lists.test.ts"
Task: "T042a tests/unit/list-loader.test.ts"
# Then domain while the Worker route is written:
Task: "T044 src/domain/lists.ts, facts.ts, membership.ts"
Task: "T045 worker/bgg/geekdo.ts + worker/routes/lists.ts + worker/routes/companies.ts"
```

---

## Implementation Strategy

### MVP First (before SPIEL Essen, 2026-10-22)

1. Phase 1 incl. the spike (T006), Phase 2.
2. US1 → deploy → usable (collections, marks, add by link).
3. US2 + US3 → the SPIEL preview in the app → deploy.
4. US4 → fair-ready (bought, filter) → deploy.
5. US5, then polish (T071–T078) as time allows; cut delight (T071–T074) first if late.

### Incremental Delivery

Each story ends with a deploy and its quickstart scenarios; Release 1.0 (US6) follows once BGG grants
the token.

---

## Notes

- Resolved after `/speckit-analyze`: renaming/deleting collections (FR-001a, T037a), adding with no
  collection (FR-016, T036), mixed currencies (FR-008, T055/T059), test-first gaps (T012a, T012b,
  T027a, T042a), publishers filled in after the first page (T042, T045, T046).
- Out of scope for 0.5 (spec Assumptions): undo swipe (CHK005), sync status (CHK006).
- Commit after each task or logical group (`F001 T0xx: …` per docs/commit-conventions.md).
- The prototype is a visual reference only; no code is copied from it.
