# Tasks: Official BGG Data and Search

**Input**: Design documents from `/specs/006-bgg-xml-search/`
**Prerequisites**: plan.md, spec.md, design.md, research.md (R1–R10), data-model.md, contracts/api.md,
contracts/ui.md, quickstart.md; design rules `docs/design.md` v2.4.0; ADRs 0001–0006 and 0007
(Proposed); the code of features 001–005.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before the
code it covers and must fail first. No live BGG in tests: XML answers come from
`tests/fixtures/bgg-xml/`; e2e tests fake `/api/me`, `/api/bgg/search` and `/api/bgg/games` in
`tests/e2e/helpers.ts`. The token is never written into a fixture, test, log or commit.

**Organization**: US2 first (the official source is the base for search and changes nothing
visible), then US1 (Search), then US3 (Add game by name). Each is deployable alone after Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US3)

## Path Conventions

As before: `src/domain/`, `src/client/`, `src/app/`, `worker/`, `tests/{unit,worker,e2e,fixtures}/`.

---

## Phase 1: Setup

- [X] T001 Add `fast-xml-parser` ^5 to `dependencies` in `package.json` (`npm install fast-xml-parser`) and check that `npm run build` still bundles the Worker
- [X] T002 Record official XML answers into `tests/fixtures/bgg-xml/` with a one-off script `scripts/record-bgg-xml.mjs` that reads `BGG_TOKEN` from the environment (the owner runs it with the token in `.dev.vars`; the script never prints the token): `thing-295947-374341.xml` (`thing?id=295947,374341&stats=1`, a game and an expansion), `thing-unrated.xml` (a game without ratings, e.g. a fresh preview game), `search-cascad.xml` (`search?query=cascad&type=boardgame,boardgameexpansion`), `geeklist-66420.xml` (`xmlapi/geeklist/66420`, the same list as `tests/fixtures/bgg/geeklist-66420.json`) and `geeklist-202.xml` (a 202 "accepted" body, hand-written if BGG answers 200 at once). Confirm research R1, R4, R5, R6 against them and correct research.md where BGG differs — 2026-11-05: recorded `thing-295947-385318.xml` (game, expansion, an rpgitem), `thing-477191.xml` (rating without geek rating), `search-cascad.xml`, `geeklist-66420.xml`; `geeklist-202.xml` hand-written; findings in research.md
- [ ] T003 [P] Add `fakeSearch(page, { token, results, games })` to `tests/e2e/helpers.ts`: fakes `/api/me` (`bggSearch: token`), `/api/bgg/search` (answers by `q`, optional delay and status 503/429 for the error tests) and `/api/bgg/games` for the result ids

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 [P] Write failing unit tests in `tests/unit/bgg-search.test.ts` for `searchQuery` ("trimmed, inner whitespace collapsed; valid for 2–100 characters, else { ok: false, reason: 'short' | 'long' }"; only spaces → short), `rankResults` (exact folded match first, then prefix, then the rest; within a group shorter name first, then alphabetical; "Tôkaidô" matched by "tokaido"; cut at `limit`) and `parseGameInput` (empty; link via `parseGameLink`, incl. an invalid link with its message; a name otherwise)
- [X] T005 Implement `searchQuery`, `rankResults`, `parseGameInput` and the `SearchResult` type (`bggId` positive integer, `name`, `year` integer | null, `kind` 'boardgame' | 'expansion') in `src/domain/bgg-search.ts`, reusing `fold` from `src/domain/search.ts` (export it there)
- [X] T006 [P] Write failing worker tests in `tests/worker/bgg-cache.test.ts` for the client: `getXml(url, ttl)` sends `Authorization: Bearer <token>` only when a token was given (and keeps the `User-Agent`), the cache key is the URL (no token in it), 202 is retried up to 3 times 2 s apart then fails as `bgg_rate_limited` with `retryAfter` 5, 401/403 become `bgg_unavailable` and call the logger with "bgg token rejected <status>" and nothing containing the token, malformed XML becomes `bgg_unavailable`, `getJson` behaves as before
- [X] T007 Extend `createBggClient` in `worker/bgg/cache.ts`: optional `token` and `log` deps, a shared `getText(url, ttl, { accept, validate })` under the existing throttle and cache, `getXml` and `getJson` on top, 202/401/403 handling as in T006, `TTL.search = 86400`
- [X] T008 [P] Add `worker/bgg/xml.ts`: an `XMLParser` (`ignoreAttributes: false`, `attributeNamePrefix: ''`, `isArray` for `item`, `link`, `name`, `rank`), `parseXml(text)` that throws on malformed input, and `decodeText` for numeric entities (`&#10;` → newline) and trimming; unit-tested in `tests/worker/bgg-xml.test.ts` with the T002 fixtures
- [X] T009 Change `worker/bgg/source.ts`: `search(query: string, limit: number): Promise<SearchResult[]>` and `readonly fetchLimit: number` on `BggSource`; `GeekdoSource` in `worker/bgg/geekdo.ts` gets `fetchLimit = 10` and keeps throwing for search; `worker/routes/games.ts` uses `ctx.bgg.fetchLimit` instead of `MAX_FETCH`

**Checkpoint**: `npm test` green; nothing visible changed.

---

## Phase 3: User Story 2 - Game data comes the official way (Priority: P1)

**Goal**: with `BGG_TOKEN`, game details with ratings and geeklists come from the official XML API; previews, companies and galleries stay on website data; without the token nothing changes.

**Independent Test**: worker tests with the fixtures show the same `Game` values as the website source for 295947 and only `boardgamegeek.com/xmlapi…` requests for games and geeklists; quickstart "Against BoardGameGeek" steps 3–5 and 7.

### Tests for User Story 2

- [ ] T010 [P] [US2] Write failing tests in `tests/worker/bgg-official.test.ts` for `OfficialSource.getGames`: one `thing?id=…&stats=1` request per 20 ids (no `type` parameter; items other than boardgame/boardgameexpansion dropped, e.g. the rpgitem 374341); mapping as research R4 (primary name, year 0 → null, thumbnail, decoded description, kind expansion, players, designers, mechanisms, first publisher, rating/geekRating rounded to two decimals, 0 → null); unknown ids left out; values for 295947 equal those of `tests/fixtures/bgg/geekitems-295947.json` + `dynamicinfo-295947.json` except the description's length (SC-004)
- [ ] T011 [P] [US2] Write failing tests in `tests/worker/bgg-official.test.ts` for `OfficialSource.getListPage('geeklist', id, page)`: one `xmlapi/geeklist/<id>` request for all pages (cached 1 hour), pages of 25 with `pageCount` and positions as today, only `objecttype="thing"` with subtype boardgame/boardgameexpansion, `thumbnailUrl: null`, title from the list; 202 then 200 works through the client retry
- [ ] T012 [P] [US2] Write failing tests in `tests/worker/bgg-routing.test.ts` for `pickSources(env, deps)`: without `BGG_TOKEN` every kind is `GeekdoSource` and `/api/me` says `bggSearch: false`; with it games, search and geeklist are `OfficialSource`, preview, companies and gallery are `GeekdoSource`; both share one client (one throttle); a 401 from BGG makes `/api/bgg/games` answer 503 `bgg_unavailable` and makes no website request (FR-007)

### Implementation for User Story 2

- [ ] T013 [US2] Implement `OfficialSource` in `worker/bgg/official.ts` (`getGames` in batches of 20, `fetchLimit = 40`, `getListPage` for geeklists only, `search` filled in by T020), using `parseXml`/`decodeText` from `worker/bgg/xml.ts` and the shared client
- [ ] T014 [US2] Implement `pickSources` in `worker/bgg/routing.ts` returning one `BggSource` facade that sends `getGames`, `search` and geeklist pages to the official source and `getListPage('preview', …)`, `getCompanies`, `getGallery` to the website source when a token is set
- [ ] T015 [US2] Wire it in `worker/index.ts`: build the shared client once per isolate with `token: env.BGG_TOKEN` and `log: console.error`, use `pickSources` instead of `new GeekdoSource`, keep `/api/me` as is; check that no response, error message or log line contains the token
- [X] T016 [US2] Update `docs/adr/0005-bgg-adapter-and-bridge.md` status to "Superseded by 0007 (selection rule only)" and `docs/adr/0007-bgg-source-per-kind-of-data.md` to Accepted, with the README table, once the user has accepted ADR 0007

**Checkpoint**: deployable; the owner can now set the token (`npx wrangler secret put BGG_TOKEN`) and see no visible change.

---

## Phase 4: User Story 1 - Find a game by its name (Priority: P1) 🎯 MVP

**Goal**: the Search place searches BoardGameGeek, shows ranked results with a big + each, a game info sheet on tap and an add to collections sheet on +.

**Independent Test**: open Search, type "cascad": Cascadia first, expansions marked; tap the + next to Cascadia, tick "Essen 2026", choose Must Have, Done: the game is in Essen 2026 as Must Have; tapping Cascadia shows only its info.

### Tests for User Story 1

- [ ] T017 [P] [US1] Write failing tests in `tests/worker/bgg-official.test.ts` for `OfficialSource.search`: `search?query=<q>&type=boardgame,boardgameexpansion`, duplicates merged by id with the expansion kind winning, primary name else the first name, year 0/missing → null
- [ ] T018 [P] [US1] Write failing tests in `tests/worker/search-route.test.ts` for `GET /api/bgg/search` (contracts/api.md): `q` 2–100 after trimming and `limit` 1–50 (default 50) else 400; ranked with `rankResults`; 503 `bgg_search_unavailable` (`retryable: false`) without a token; 503 `bgg_unavailable` / 429 with `Retry-After` passed through; the same normalised query within a day makes no second BGG request
- [ ] T019 [P] [US1] Write failing Playwright tests in `tests/e2e/search.spec.ts` with `fakeSearch` against contracts/ui.md: field ready, hint "Type at least 2 letters.", no action bar; typing "cascad" shows the status "<n> games · exact matches first" and rows named "<game>, <year>[, expansion]" with "in Essen 2026" for a seeded game; covers replace initials; "+" opens "Add <game>", ticking and Done adds it with the chosen category and toasts; tapping a row opens "<game>" with Close and no checkboxes; no match, 50 results with the "More games match" line, offline and not-reachable notes with Try again; a slow older answer does not replace a newer one (US1-7); no token shows the "comes soon" card without an action bar; axe clean at 360 px and with reduced motion

### Implementation for User Story 1

- [ ] T020 [US1] Implement `OfficialSource.search(query, limit)` in `worker/bgg/official.ts` (cached `TTL.search` per normalised query) to pass T017
- [ ] T021 [US1] Add `worker/routes/search.ts` and wire `GET /api/bgg/search` in `worker/index.ts` to pass T018 (the website source keeps answering 503 `bgg_search_unavailable`)
- [ ] T022 [P] [US1] Add `searchGames(q, limit, signal)` to `src/client/api.ts` returning `SearchResult[]` and mapping 503/429/offline to the existing `ApiError` kinds
- [ ] T023 [US1] Add `src/app/hooks/useBggSearch.ts` (research R8): 0.5 s debounce, `searchNow()` for Enter, `AbortController` plus sequence number (newest wins), states idle/short/loading (with previous results)/waiting/done/offline/unavailable, then covers through the existing games loader in chunks of 20; unit-test its reducer in `tests/unit/bgg-search-state.test.ts` first
- [ ] T024 [P] [US1] Add `src/app/components/SearchResultRow.tsx` (row button with cover, name, year or "Year unknown", Expansion pill, teal "in <collection>" / "in <n> collections" as `aria-describedby`; big + button "Add <game> to a collection"; `compact` variant without +) and `src/app/theme/search.css` (rows, status line, notes, placeholder rows, Found game card) per docs/design.md v2.4.0
- [ ] T025 [P] [US1] Add `src/app/components/GameInfoSheet.tsx`: cover button opening `ImageViewer`, "year · [Expansion · ]publisher", Open on BoardGameGeek, description, `InfoList` with source "From BoardGameGeek", Close; no collections, category or adding actions
- [ ] T026 [US1] Add `src/app/components/AddToCollectionsSheet.tsx`: "Add <game>", Found game card, the collection ticks with notes (move `Pick` and `note` out of `src/app/components/MembershipSheet.tsx` into `src/app/components/CollectionPicks.tsx` and use them in both), "Category when added (optional)" with `CategoryPicker`, Done/Cancel; add `addToCollections(services, game, before, after, mark)` to `src/app/actions.ts` (sharing the entry logic of `applyMembership` in `src/app/list-actions.ts`, without list facts) and the toast "Added <game> to <n> collection(s)[. Removed it from <n> collection(s)]"
- [ ] T027 [US1] Rewrite `src/app/screens/Search.tsx`: with `bggSearch` the label, field (placeholder "Game name, e.g. Cascadia", Enter searches at once), hint, separator, status line (`role=status`), result rows or the empty/offline/not-reachable states, the two sheets; without it today's "comes soon" card; no `ActionBar` in either case; remove the disabled Search main button from `src/app/components/ActionBar.tsx` usages and the "Search (not available yet)" name

**Checkpoint**: Search works end to end with the token; without it the place looks as today minus the action bar.

---

## Phase 5: User Story 3 - Add a game by name in a collection (Priority: P2)

**Goal**: the collection's Add game sheet has one field for a name or a link; a name shows up to 8 matches.

**Independent Test**: in Essen 2026, Add game, type "harmon", pick Harmonies, choose Interested, Add to collection: Harmonies is in Essen 2026 as Interested.

### Tests for User Story 3

- [ ] T028 [P] [US3] Write failing Playwright tests in `tests/e2e/add-game-name.spec.ts` with `fakeSearch`: textbox "Game name or BoardGameGeek link"; "harmon" lists at most 8 buttons in "Matching games" without add buttons; picking shows "Found game ID <id>", Change and the editable name; a pasted link behaves as before (existing add-game tests stay green); a game already in the collection shows "This game is already in Essen 2026." and disables Add to collection; without a token a name says to paste a link instead; axe clean

### Implementation for User Story 3

- [ ] T029 [US3] Change `src/app/components/AddGameSheet.tsx` to one field using `parseGameInput`: link → existing link state; name → `useBggSearch(8)` with compact `SearchResultRow`s; a pick or a recognised link shows the Found game card (cover via games loader, Change back to the field) and the Name field; status lines for searching/offline/not reachable under the field; keep the category picker and `addGameByLink`; adapt `src/app/components/GameLinkFields.tsx` so the shared Share sheet keeps its current look

**Checkpoint**: all three stories done.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Extend `tests/e2e/a11y.spec.ts` with the Search place (results, no match, error), game info sheet, add to collections sheet and the Add game sheet with matches (axe, focus order, 44px targets, reduced motion project)
- [ ] T031 [P] Update `CLAUDE.md` (new `src/domain/bgg-search.ts`, `worker/bgg/official.ts`, `routing.ts`, the token note: set by the owner with `npx wrangler secret put BGG_TOKEN`, never in the repo) and `docs/hosting/setup.md` with the token step
- [ ] T032 Run `npm test`, `npm run build` and `npm run test:e2e`; record the results here
- [ ] T033 Deploy (`npm run deploy`); the owner sets the token; walk through `specs/006-bgg-xml-search/quickstart.md` ("Against BoardGameGeek" and "Production") with the user

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → stories. T002 needs the owner's token locally; T010–T011, T017 need its fixtures.
- **US2 (Phase 3)** before US1's worker part (T020–T021 extend `official.ts` and `index.ts`); US1's UI tasks (T022–T027) only need Phase 2 and can start earlier against the faked API.
- **US3** needs `useBggSearch` (T023) and `SearchResultRow` (T024) from US1.
- **Polish** after the shipped stories.
- Same-file order: `worker/bgg/official.ts` T013 → T020; `worker/index.ts` T015 → T021; `MembershipSheet.tsx` refactor in T026 before any other change to it.

## Parallel Opportunities

- Phase 1: T003 alongside T001/T002.
- Phase 2: T004, T006, T008 together; then T005, T007, T009.
- US2: T010, T011, T012 together; then T013 → T014 → T015.
- US1: T017, T018, T019 together; T022, T024, T025 together; then T023 → T026 → T027.
- US3: T028 any time after Phase 1.

## Implementation Strategy

1. **Official data first**: Phases 1–3 → deploy → the owner sets `BGG_TOKEN`. Nothing visible changes (SC-003, SC-004, SC-006).
2. **MVP**: US1 → deploy. Search by name works (SC-001, SC-002, SC-005).
3. **Then** US3 → deploy; Polish.

Suggested Orca Swarm split (docs/orca-swarm.md), after Phase 2 on the branch:
A = US2 + US1 worker part (T010–T021: official source, routing, search route), B = US1 UI
(T022–T027), C = US3 (T028–T029, after B's T023/T024 are merged). Merge order A → B → C.
