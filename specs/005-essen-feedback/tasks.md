# Tasks: Essen Feedback (Categories, Row Actions, Quick Filters, List Resync)

**Input**: Design documents from `/specs/005-essen-feedback/`
**Prerequisites**: plan.md, spec.md, design.md, research.md (R1–R12), data-model.md, contracts/ui.md,
quickstart.md; design rules `docs/design.md` v2.2.0; ADRs 0001–0006; the code of features 001–004.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before the
code it covers and must fail first. No live BGG in tests: ratings come from
`tests/fixtures/bgg/dynamicinfo-295947.json`; e2e tests fake `/api/bgg/*` through `tests/e2e/helpers.ts`.

**Organization**: by user story, in delivery order for the fair: US1, US2 (P1), then US3, US4, US6
(P2), then US5 (P3). Each story is deployable on its own after Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US6)

## Path Conventions

As before: `src/domain/`, `src/client/`, `src/app/`, `worker/`, `migrations/`, `tests/{unit,worker,e2e,fixtures}/`.

---

## Phase 1: Setup

- [X] T001 [P] Add `IconBag`, `IconBagCheck` (bag with ✓), `IconCategory` (two hexagons) and `IconResync` (two circling arrows) to `src/app/components/icons.tsx`, drawn as in `specs/005-essen-feedback/design/prototype.html` (`ICON.bag`, `ICON.bagOk`, `ICON.cat`, `ICON.resync`)
- [X] T002 [P] Extend `fakeBgg(page)` in `tests/e2e/helpers.ts` so faked `/api/bgg/games` answers carry `rating` and `geekRating` (`7.88` / `7.73` for 295947 from `tests/fixtures/bgg/dynamicinfo-295947.json`, `null` for games without), and add a helper `seedCollection(page, name, games)` that creates a collection with entries in given categories, booths (e.g. `"3"`, `"Hall 2"`, `"7-C111 / 3"`), listed prices and bought states, for the stories' e2e tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the new category `later` and its look, which rows (US1), filters (US2) and the picker (US3) all use.

**⚠️ CRITICAL**: no user story work before this phase is complete.

- [X] T003 [P] Unit tests in `tests/unit/marks.test.ts`: `MARKS` order is `new, must_have, interested, unsure, later, poop, skip`; `later` has label "For later" and emoji ⏳; `new` is labelled "No category yet"; `isMark('later')` is true; `markOrder('later')` sits between unsure and poop. In `tests/unit/collection-view.test.ts`: `groupByMark` puts For later after Unsure in the categorised part; `countMarks` counts `later`. In `tests/unit/backup.test.ts`: a backup with a `later` entry restores; an older one without it restores unchanged
- [X] T004 [P] Worker test in `tests/worker/sync.test.ts`: pushing an entry with `mark: "later"` is accepted and returned by `GET /api/sync`
- [X] T005 Add `{ key: 'later', label: 'For later', emoji: '⏳' }` after `unsure` and relabel `new` to "No category yet" in `src/domain/marks.ts`; adjust anything that lists marks by hand (`src/domain/share.ts`, `src/domain/collection.ts` part split) so T003–T004 pass
- [X] T006 [P] Add the For later tone `[data-mark='later'], [data-tone='later'] { --tone: linear-gradient(135deg, #d946ef 0%, #f9a8d4 100%); --tone-text: var(--ink); }` to `src/app/theme/components.css` (design rules §3 "pink")

**Checkpoint**: For later exists everywhere categories are listed (filter, counts, Show-off sheet, share); `npm test` green.

---

## Phase 3: User Story 1 - Buy a game or change its category straight from the list (Priority: P1) 🎯 MVP

**Goal**: category as the row's 1px gradient border; Buy and Category actions on the row with their sheets (FR-004–FR-009).

**Independent Test**: collection → Buy on a not-bought game → 25 → Got it: bought for €25, Buy shows €25; Buy again: not bought. Category on an Interested game → Must Have: border orange, game in Must Have.

### Tests for User Story 1

- [ ] T007 [P] [US1] E2E tests in `tests/e2e/row-actions.spec.ts` (contracts/ui.md "Collection screen", "Sheets"): row has buttons "Buy <game>" and "Category of <game>" and no mark pill; Buy → dialog "Bought <game>" → 25 → "Got it" → toast "<game>: got it for €25!", Buy button `aria-pressed=true` with text "€25", bought line updates; Buy on a bought game → toast "<game>: not bought any more", no dialog; Category → dialog "Category of <game>" with seven buttons, current pressed → "⭐ Must Have" → toast, row now in the Must Have group; the row's open button name includes category and bought; axe clean with both sheets open; offline project: buy and category change work and survive a reload

### Implementation for User Story 1

- [X] T008 [US1] Move `PaidForm` out of `src/app/components/GameSheet.tsx` into `src/app/components/BuySheet.tsx` (a `Sheet` titled "Bought <game>?" with the lead "What did you pay? Leave it empty to just tick it off.", price + currency, Cancel / **Got it**), saving via the existing `buyGame` action (celebration, sound, toast); `GameSheet` uses it for "✅ Bought it"
- [ ] T009 [P] [US1] Create `src/app/components/CategorySheet.tsx`: `Sheet` "Category of <game>", a list of 52px buttons (gradient hexagon, emoji, label) Must Have … Poop, a thin line, No category yet and Not interested; current one `aria-pressed` with "current"; a tap calls `setMark`, closes, toasts "<game> → <emoji> <label>" (design rules "Category sheet")
- [ ] T010 [US1] Rebuild `src/app/components/GameRow.tsx` (research R3): `div.row[data-mark]` with a `button.row-open` (cover, name, publisher, info line; accessible name "<game>, <category>[, bought]") and `div.row-acts` with `button.row-act.buy` (`aria-pressed`, `IconBag`/`IconBagCheck`, label "Buy" / price paid / "Bought") and `button.row-act.cat` (`IconCategory`, "Category"); remove the mark pill and the "✅ €paid" pill; props `onBuy`, `onCategory`
- [ ] T011 [P] [US1] Styles in `src/app/theme/components.css`: `.row` with `border: 1px solid transparent; background: linear-gradient(var(--deck), var(--deck)) padding-box, var(--tone) border-box` (No category yet: `--border`; Not interested keeps its dimmed, struck-through look); `.row-open`, `.row-acts`, `.row-act` (≥ 46×52px, 32px hexagon, 10px label, bought state with `--grad-got`), as in the prototype's `.crow*`/`.ract*`
- [ ] T012 [US1] Wire the row actions in `src/app/screens/Collection.tsx`: local state `{ sheet: 'buy' | 'category', entry }`; Buy on a not-bought game opens `BuySheet`, on a bought one calls `unbuyGame` and toasts "<game>: not bought any more"; Category opens `CategorySheet`; T007 passes; adjust existing e2e tests that clicked rows or read mark pills (`tests/e2e/us4-fair.spec.ts`, `collection-actions.spec.ts`, `show-off.spec.ts`)

**Checkpoint**: US1 works and can be deployed alone.

---

## Phase 4: User Story 2 - Find the next game at the fair (Priority: P1)

**Goal**: quick filters (Cat | Booth, 🛒 Buy) and search between the separators; no filter summary; Clear filters; hall-only booths; Not interested follows the filter; every group folds (FR-013–FR-020, FR-018a).

**Independent Test**: Booth → a game with booth "3" in Hall 3; 🛒 Buy → only not-bought Must Have/Interested/Unsure, Filter highlighted; type "cas" → only matching; Filter → Clear filters → all, by categories.

### Tests for User Story 2

- [ ] T013 [P] [US2] Unit tests in `tests/unit/filter.test.ts` (research R5, data-model "Device meta"): `buyOn(filter)` → groups `{must_have, interested, unsure}`, bought `no`, price `all`, `buy.before` = the old filter; `buyOff` restores it; `toStored`/`fromStored` keep `buy`; `isDefaultView(filter, groupBy)` true only for all categories (incl. `later`), bought `all`, price `all`, no `buy`, `mark`; `PRESETS.all` is the Clear filters target
- [ ] T014 [P] [US2] Unit tests in `tests/unit/booths.test.ts` (research R6): `"3"` and `"Hall 3"` → Hall 3 as hall-only; `"7-C111 / 3"` → Hall 7 and Hall 3; `"3-A100 / 3"` → once in Hall 3; within a hall full booths first (by booth, numeric), then hall-only by name; `"Hall foyer"` → "No booth yet"; `groupByHall` keeps Not interested entries it is given
- [X] T015 [P] [US2] Unit tests in `tests/unit/search.test.ts` for `matchesName(name, query)`: case- and accent-insensitive ("Café" matches "cafe", "CAS" matches "Cascadia"), empty query matches all, whitespace trimmed
- [ ] T016 [P] [US2] E2E tests in `tests/e2e/quick-filters.spec.ts` (contracts/ui.md): quick filters group between the two separators, no `.filter-summary`; toggle switches grouping and its name; Buy chip `aria-pressed`, count text, Filter action "Filter (active)"; changing a segment in the sheet turns Buy off; Clear filters disabled at default, resets everything; Not interested shown under booths only when selected; search narrows, "No game called “zzz” here." + Clear the search; every group heading is a fold button, For later, Poop, Not interested start folded (expanded = false), others open; folding not remembered after reload; replace the summary assertions in `tests/e2e/us4-fair.spec.ts` and `tests/e2e/collection-actions.spec.ts`, update `tests/e2e/group-by.spec.ts` to the new labels

### Implementation for User Story 2

- [ ] T017 [US2] Implement in `src/domain/filter.ts`: `StoredFilter.buy?: { before: StoredFilter }`, `buyOn`, `buyOff`, `isDefaultView`; `filterLabel` texts say "categories"; T013 passes
- [ ] T018 [P] [US2] Implement hall-only booths and the filter-driven grouping in `src/domain/booths.ts`; T014 passes
- [X] T019 [P] [US2] Create `src/domain/search.ts` with `matchesName`; use it in `src/app/screens/List.tsx` too (replaces the lower-case `includes`); T015 passes
- [ ] T020 [US2] Make `src/app/components/GroupHeading.tsx` always a fold button with chevron and `aria-expanded`; in `src/app/screens/Collection.tsx` keep the folded set per visit, initially `later`, `poop`, `skip` (halls and "No booth yet" open)
- [ ] T021 [US2] Create `src/app/components/QuickFilters.tsx`: group "Quick filters" with the Cat | Booth toggle (one pill, current filled hot, accessible name per contracts/ui.md), the 🛒 Buy chip (`aria-pressed`), the muted count, and below them the search field ("Search this collection"); styles `.quick`, `.qtoggle`, `.search` in `src/app/theme/fair.css`
- [ ] T022 [US2] Update `src/app/components/FilterPanel.tsx`: "Categories" with counts and Select all / none, Price labels "≤ €30 / €30–60 / > €60", Group by "Categories" / "Booths", bottom row **Clear filters** (disabled at default) / **Done**; any change drops `buy`
- [ ] T023 [US2] Update `src/app/screens/Collection.tsx`: remove the `filter-summary` button; layout bought line → separator → `QuickFilters` → separator → groups; search state (not stored) filters with `matchesName`; booth grouping gets the filtered entries; Filter action `is-active` + name "Filter (active)" from `isDefaultView`; empty search result line; remove `.filter-summary` from `src/app/theme/fair.css`; T016 passes

**Checkpoint**: US1 + US2 = the fair release; deploy.

---

## Phase 5: User Story 3 - "For later", Category naming and the honeycomb picker (Priority: P2)

**Goal**: "Category" in every text; the details' picker as a 3 + 2 honeycomb above the info box (FR-001, FR-010, FR-011).

**Independent Test**: open a game's details: five hexagons in a honeycomb above the info box; tap For later: the game moves to For later and its border turns pink.

### Tests for User Story 3

- [ ] T024 [P] [US3] E2E tests in `tests/e2e/categories.spec.ts`: details show group "Category" with five buttons above the info box (DOM order), top row Must Have/Unsure/Poop and bottom row Interested/For later by bounding boxes, each ≥ 44px; For later pressed after a tap and the row's group heading is "⏳ For later"; "🛑 Not interested" link; no visible text "mark"/"Not yet marked" on collection, filter sheet, Show-off sheet and share screen; axe clean

### Implementation for User Story 3

- [ ] T025 [US3] Create `src/app/components/CategoryPicker.tsx` (research R9): five pointy-top hexagons in a 6-half-column × 2-row grid (row 2 pulled up a quarter hexagon), ≤ 88px, 4px gaps, `.picker-btn` look, group name "Category"; styles in `src/app/theme/components.css`
- [ ] T026 [US3] In `src/app/components/GameSheet.tsx` put `CategoryPicker` and the Not interested link directly under the head, above the facts box (replaces the `HexPicker` of marks)
- [ ] T027 [P] [US3] Replace user-visible "mark"/"group" wording with "Category" in `src/app/screens/Share.tsx`, `src/app/components/ShowOffSheet.tsx`, `src/app/screens/ShowOff.tsx`, `src/app/components/FilterPanel.tsx`, `src/app/screens/Swipe.tsx`, `src/app/screens/Intro.tsx` and toasts in `src/app/actions.ts`; T024 passes

**Checkpoint**: US3 done; categories read the same everywhere.

---

## Phase 6: User Story 4 - Rating and geek rating; BG-Tinder shows the details (Priority: P2)

**Goal**: BGG ratings in the info box of the details, a list game's sheet and the BG-Tinder card; the card shows the details' content (FR-012, FR-012a).

**Independent Test**: details of 295947 show "Rating 7.9" and "Geek rating 7.7"; BG-Tinder card shows publisher · year, the info box with ratings and the full description.

### Tests for User Story 4

- [ ] T028 [P] [US4] Worker test in `tests/worker/bgg-games.test.ts`: `GET /api/bgg/games?ids=295947` reads `api/dynamicinfo?objectid=295947&objecttype=thing` (fixture) and returns `rating: 7.88`, `geekRating: 7.73`; `baverage "0"` or a missing `stats` → `null`; the second call within the TTL makes no upstream request; stored in and read from `game` (repository round trip)
- [ ] T029 [P] [US4] Unit tests in `tests/unit/game-info.test.ts`: `gameInfos` order price, players, rating, geek rating, booth, …; ratings with one decimal ("7.9"); `null` left out; `rowInfos` never returns rating keys
- [ ] T030 [P] [US4] E2E tests in `tests/e2e/game-info.spec.ts`: details info box has "Rating" 7.9 and "Geek rating" 7.7; a game without ratings shows neither; BG-Tinder card (group "Game: <game>") contains the publisher · year line, the same info box with ratings, and the full description (no 3-line clamp); rows show no ratings

### Implementation for User Story 4

- [ ] T031 [US4] Add `migrations/0005_ratings.sql`: `ALTER TABLE game ADD COLUMN IF NOT EXISTS rating numeric(4,2)`, `... geek_rating numeric(4,2)`; `UPDATE game SET fetched_at = '2000-01-01T00:00:00Z' WHERE rating IS NULL AND geek_rating IS NULL` (data-model "Game")
- [ ] T032 [US4] Read ratings in `worker/bgg/geekdo-games.ts` (research R1: `dynamicinfo`, `stats.average` / `stats.baverage`, values ≤ 0 → null, cached with `TTL.game`), add `rating`, `geekRating` to `Game` in `worker/bgg/source.ts` and to `GameDetails` in `src/domain/game-info.ts`, store and read them in `worker/db/repository.ts`; T028 passes
- [ ] T033 [US4] Add the rating infos to `gameInfos` and skip them in `rowInfos` (`src/domain/game-info.ts`); render rating values as small hexagons (cool / dusk) in `src/app/components/GameInfo.tsx` with `.rating` styles in `src/app/theme/components.css`; T029 passes
- [ ] T034 [US4] Update `src/app/components/SwipeCard.tsx` and `src/app/theme/swipe.css`: "publisher · year" line, `InfoList` inside a `facts-box`, then the full description (remove the clamp); T030 passes
- [ ] T035 [P] [US4] Add `rating` and `geekRating` to `GET /api/bgg/games` in `specs/001-bgg-game-collection/contracts/api.md`

**Checkpoint**: ratings visible after the migration; BG-Tinder matches the details.

---

## Phase 7: User Story 6 - Copy or move a game to another collection (Priority: P2)

**Goal**: Copy to collection and Move to collection in the details (FR-026a–c).

**Independent Test**: Harmonies (Must Have, bought €38) → Move to collection → Christmas 2026 → Move: gone here, there as Must Have, bought €38, with its booth.

### Tests for User Story 6

- [ ] T036 [P] [US6] Unit tests in `tests/unit/membership.test.ts` (data-model "Entry"): `copyEntry` keeps mark, facts, factsSource, not bought, `updatedAt = now`; `moveEntry` returns the full new entry and a tombstone of the source; both throw/return an error for a target with a live entry of the game; a target with a removed (tombstone) entry is allowed and revives it
- [ ] T037 [P] [US6] E2E tests in `tests/e2e/copy-move.spec.ts`: buttons "Copy to collection" and "Move to collection" above "Remove from <collection>"; dialog "Copy <game>" with combobox "To collection", "(already in it)" option disabled; Copy → toast, details stay open, game in both; Move → toast, details closed, game only in the target with category, bought and price; only one collection → confirm disabled with the note; offline: works and syncs after reconnect

### Implementation for User Story 6

- [ ] T038 [US6] Implement `copyEntry`, `moveEntry` in `src/domain/membership.ts`; T036 passes
- [ ] T039 [US6] Add `copyGameTo`, `moveGameTo` actions in `src/app/actions.ts` (store write through the outbox, toasts "Copied <game> to <collection>" / "Moved <game> to <collection>")
- [ ] T040 [US6] Create `src/app/components/CopyMoveSheet.tsx` (design rules "Copy and move": dropdown with "(already in it)", what goes along, Cancel / Copy or Move) and add the two buttons above Remove in `src/app/components/GameSheet.tsx`; Copy returns to the details, Move closes them; T037 passes

**Checkpoint**: games move between collections without losing category or price.

---

## Phase 8: User Story 5 - Resync a BGG list and settle conflicts (Priority: P3)

**Goal**: Resync in a BGG list's heading; empty fields filled; hand-typed differences as conflicts with a sheet (FR-021–FR-026).

**Independent Test**: a game with booth "3" typed by hand, the preview now "3-A100"; another without price, preview has one → Resync: price filled silently; conflicts sheet shows "Own 3" / "BGG 3-A100"; choose BGG → Booth 3-A100.

### Tests for User Story 5

- [X] T041 [P] [US5] Unit tests in `tests/unit/facts.test.ts` for `reconcileFacts(entries, fresh, declined, now)` and `applyConflictChoices` (data-model "Facts reconcile" table): no facts → take list facts as `preview`; `preview` → list wins; `manual` empty field → filled, source stays `manual`; `manual` differing field → conflict `{collectionId, bggId, field, own, bgg}`; equal → nothing; declined same BGG value → no conflict, declined but BGG changed → conflict again; price compares cents + currency; removed entries untouched; one conflict per collection when two collections differ; apply BGG choice → value written, source `preview` once no own value differs; apply own → declined key recorded
- [X] T042 [P] [US5] Unit test in `tests/unit/list-loader.test.ts`: `resync(kind, id)` reloads every page from 1 (throttled as before), runs `reconcileFacts` only after the last page, writes updates in one `updateEntries` transaction and returns `{ updated, conflicts }`; a failing page stops without reconciling
- [X] T043 [P] [US5] E2E tests in `tests/e2e/resync.spec.ts` (faked preview pages): button "Resync with BGG" in the list heading, disabled offline; status line "Resyncing with BGG… n / total"; toast "Resync done: …"; dialog "Conflicts" with "Own 3" / "BGG 3-A100", Use BGG for all applies and closes, the collection shows Booth 3-A100; Later keeps own and the next resync asks again; Use own for all → the next resync (same BGG value) shows no conflicts; BGG 503 → busy toast, nothing changed

### Implementation for User Story 5

- [X] T044 [US5] Implement `reconcileFacts` and `applyConflictChoices` in `src/domain/facts.ts`; T041 passes
- [X] T045 [US5] Add meta key `declinedFacts` to `src/client/store.ts` and `resync(kind, id)` to `src/client/lists.ts` (research R10); T042 passes
- [X] T046 [US5] Create `src/app/components/ConflictsSheet.tsx` (design rules "Resync and conflicts": "<n> conflicts", explanation, Use BGG for all / Use own for all, per conflict Own / BGG tiles with Own preselected, Later / Apply) with `.conflict`, `.choice`, `.all-row` styles in `src/app/theme/lists.css`
- [X] T047 [US5] Add the Resync icon button (spins while running, reduced motion: no spin) to the heading in `src/app/screens/List.tsx`, the progress text in the status line, the result toast and the conflicts sheet; T043 passes

**Checkpoint**: all stories done.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T048 [P] Extend `tests/e2e/a11y.spec.ts` with: collection with quick filters and row actions, Category sheet, Buy sheet, details with the honeycomb, Copy/Move sheet, BGG list with Resync, Conflicts sheet (axe, focus order, 44px targets, reduced motion project)
- [ ] T049 [P] Update `CLAUDE.md` if commands or layout changed (new `src/domain/search.ts`), and `docs/vision.md` release table if the user wants it noted
- [ ] T050 Run `npm test`, `npm run build` and `npm run test:e2e`; record the results here
- [ ] T051 Deploy (`npm run deploy`, migration on Neon via `npm run db:migrate:neon`) and walk through `specs/005-essen-feedback/quickstart.md` validation scenarios 1–14 on a phone with the user

---

## Dependencies & Execution Order

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories.
- **US1 (Phase 3)** and **US2 (Phase 4)** both touch `Collection.tsx`: run US1's T012 before US2's T023 (or one worker for both). Their domain/test tasks are independent.
- **US3** needs Phase 2; its picker touches `GameSheet.tsx`, as do US1 (T008), US4 (none) and US6 (T040): order T008 → T026 → T040.
- **US4** is independent of the others (worker, domain game-info, SwipeCard).
- **US6** needs Phase 2 only (T040 after T026 for the shared file).
- **US5** is independent (lists, facts, List screen); T047 after T019 (both in `List.tsx`).
- **Polish** after the stories that are shipped.

## Parallel Opportunities

- Phase 2: T003, T004, T006 together.
- US1: T007, T009, T011 together; then T008 → T010 → T012.
- US2: T013–T016 together; T017, T018, T019 together; then T020–T023.
- US4: T028–T030 together; T031 → T032 → T033 → T034; T035 any time.
- Across stories after Phase 2: US4 and US5 can run alongside US1/US2 (different files).

## Implementation Strategy

1. **Fair release first**: Phases 1–4 (setup, `later`, US1, US2) → test → deploy. This covers SC-001–SC-005.
2. **Second release**: US3, US4, US6 → deploy.
3. **Last**: US5 resync → deploy; Polish.

Suggested Orca Swarm split (docs/orca-swarm.md), after Phase 2 on the branch:
A = US1 + US2 (Collection screen, domain filter/booths/search), B = US3 + US6 (details: picker, copy/move),
C = US4 (worker ratings, game info, swipe card), D = US5 (resync). Merge order A → B → C → D.
