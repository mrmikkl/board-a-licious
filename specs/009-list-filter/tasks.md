# Tasks: List Filter

**Input**: Design documents from `/specs/009-list-filter/` (spec.md, design.md, plan.md, research.md
R1–R7, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md)

**Tests**: required (constitution II, test-first): every story's tests are written and seen failing
before its implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 filter a BGG list by kind of game · US2 rating ranges · US3 length limits in Config
  · US4 reading details · US5 the same filter in shopping lists · MB main button captions (design rule
  3.3.0)

## Phase 1: Setup

- [x] T001 Fixtures with `playingtime`: already recorded in F006 (`tests/fixtures/bgg-xml/thing-295947-385318.xml` has `playingtime value="45"`, `thing-477191.xml` has `value="0"`); use them, no new recording

## Phase 2: Foundational (blocking all stories)

- [x] T002 [P] Write failing unit tests in `tests/unit/game-filter.test.ts` for `src/domain/game-filter.ts`
  (data-model "GameFilter"): `lengthRanges([30, 60, 120])` → Short 0–30, Middle 31–60, Long 61–120,
  Very long 121+; `lengthOf(minutes, limits)`; `matchesGame(details, filter, limits)`: default filter
  matches everything (also without details); Length OR inside; players n with kinds best / rec (both =
  best or recommended); rating and geek rating `[from, to]` inclusive, `[0, 10]` = no filter;
  mechanisms and designers AND inside; sections AND; a game without the needed value (no
  `playingTime`, no rating, no poll for n) does not match that section; `valueCounts(games)` for
  mechanisms and designers sorted by count then name; `missingCounts(games)` per section;
  `isDefault`, `toStored` / `fromStored` round trip
- [x] T003 [P] Write failing unit tests in `tests/unit/player-poll.test.ts` for `pollKind(poll, n)` in
  `src/domain/player-poll.ts` (research R3): best when best votes are the largest; rec when not best
  and best + recommended > not recommended; null when nobody voted for n; n above the poll's largest
  row ("4+") uses that row
- [x] T004 [P] Write failing worker tests: `tests/worker/bgg-games.test.ts` maps `playingtime` to
  `playingTime` (0 → null) from `thing-295947-385318.xml` (45) and `thing-477191.xml` (0 → null) and the games route returns it;
  `tests/worker/db.test.ts`: `playing_time` round trip and migration 0008 makes old rows stale;
  `tests/worker/sync.test.ts`: `settings[].lengthLimits` pushed and pulled, absent keeps, null resets,
  invalid (not three, not increasing, outside 1–600) → 400
- [x] T005 Implement `src/domain/game-filter.ts` and `pollKind` in `src/domain/player-poll.ts`; add
  `playingTime?: number | null` to `GameDetails` in `src/domain/game-info.ts` (T002, T003 green)
- [x] T006 Add `migrations/0008_list_filter.sql` (`ALTER TABLE game ADD COLUMN IF NOT EXISTS
  playing_time integer`; `UPDATE game SET fetched_at = '1970-01-01'`; `ALTER TABLE user_setting ADD
  COLUMN IF NOT EXISTS length_limits jsonb`), map `playingtime` in `worker/bgg/official.ts`, read and
  write `playing_time` and `length_limits` in `worker/db/repository.ts`, validate `lengthLimits` in
  `worker/routes/sync.ts` (T004 green)
- [x] T007 Device side: `playingTime` in `src/client/types.ts`; meta `listFilters` and
  `bggSetting.lengthLimits` (with `lengthLimits()` defaulting to `[30, 60, 120]`) in
  `src/client/store.ts`; `lengthLimits` in the settings push / pull of `src/client/sync.ts`; tests in
  `tests/unit/store.test.ts` and `tests/unit/sync-client.test.ts`

**Checkpoint**: filter logic, playing time and the synced limits exist; no UI yet.

## Phase 3: User Story 4 - Details are read for the filter, gently (Priority: P1)

- [ ] T008 [P] [US4] Write failing unit tests in `tests/unit/game-details-hook.test.ts` for the reader
  in `src/app/hooks/useGameDetails.ts` (pure part in `src/app/hooks/game-details-state.ts`): which ids
  are missing (not stored, or stored without the key `playingTime`), chunks of 40 one after the other,
  progress `n of N`, stops offline, Try again resumes, nothing asked when all are stored
- [ ] T009 [US4] Implement `src/app/hooks/game-details-state.ts` and `useGameDetails(ids, active)`
  (reads only while `active`, i.e. a filter sheet is open or a filter is set; stores answers with
  `putGames`) (T008 green)

## Phase 4: User Story 1 - Filter a BGG list by what the game is like (Priority: P1) 🎯 MVP

- [ ] T010 [P] [US1] Write failing Playwright tests in `tests/e2e/list-filter.spec.ts` with faked
  `/api/bgg/games` (details incl. `playingTime`, mechanisms, designers, poll): in a preview Filter is
  the main button ("Filter", caption); the sheet "Filter" with Length chips and counts, Players chips
  1–6 + field "Other number of players" (typing 10 uses 10), Best / Recommended both ticked by default,
  Mechanisms and Designers with counts, Show all and the find field; ticking narrows the list at once,
  count line "<n> of <N> games", Done · n games; games without length named; Clear filters at the top
  and bottom reset; the filter survives leaving the list and a reload; own status list: Filter action
  at the left ("Filter (active)" when set), Add game as main button; friend's list: Filter as main
  button; reading progress "Reading game details from BoardGameGeek… n of N" while ids are answered in
  chunks; offline: the left-out line with Try again; axe at 360 px
- [ ] T011 [P] [US1] Create `src/app/components/GameFilterSections.tsx` (Length, Players with the
  typed field kept as typed, Mechanisms, Designers; Rating and Geek rating as slots for US2) and
  `src/app/theme/filter.css` (chips, num field, sections) after design.md and docs/design.md
  "List filter"
- [ ] T012 [US1] Create `src/app/components/ListFilterSheet.tsx` ("Filter", Clear filters top and
  bottom, Done · n games, reading line, left-out line) using `useGameDetails` and `GameFilterSections`
- [ ] T013 [US1] Wire the filter into `src/app/screens/List.tsx` and `src/app/screens/StatusList.tsx`:
  stored filter per list key in meta `listFilters`, count line under the name field with Clear filters,
  Filter as main button (previews, geeklists, friends) or action (own status lists) (T010 green)

## Phase 5: User Story 2 - Filter by rating ranges (Priority: P2)

- [ ] T014 [P] [US2] Write failing tests: `tests/unit/range-slider.test.ts` for the snapping rule
  (`snap(value, dragging)`: within 0.2 of a whole number → that number while dragging; keys unchanged;
  handles cannot cross) and e2e in `tests/e2e/list-filter.spec.ts`: sliders "Rating from", "Rating to",
  "Geek rating from", "Geek rating to"; the title shows "7.5 – 10.0" / "any"; arrow keys step 0.1;
  a drag near 7 rests on 7.0; whole numbers 0…10 shown under the track; only games in range remain
- [ ] T015 [US2] Create `src/app/components/RangeSlider.tsx` (two native ranges on one track, hexagon
  handles, ticks and labels 0…10, snapping while a pointer drags) and put Rating and Geek rating into
  `GameFilterSections.tsx` (T014 green)

## Phase 6: User Story 3 - Set the length ranges in Config (Priority: P2)

- [x] T016 [P] [US3] Write failing Playwright tests in `tests/e2e/game-length.spec.ts`: Config
  "Game length" with the four rows and defaults; "Short ends at minutes" 45 → the range texts follow,
  Save game length toasts "Saved the game length"; not increasing → error line and Save disabled;
  Reset disabled at 30 / 60 / 120; a list's Length chips use the new ranges; the limits are pushed with
  sync
- [x] T017 [US3] Create `src/app/components/LengthSettings.tsx` and add it to
  `src/app/screens/Config.tsx` (T016 green)

## Phase 7: User Story 5 - The same filter in shopping lists (Priority: P2)

- [ ] T018 [P] [US5] Write failing tests: `tests/unit/filter.test.ts` (`applyFilter` with `game` set
  uses the entry's game details; `isDefaultView` false when `game` is set; Clear resets `game`) and
  e2e in `tests/e2e/list-filter.spec.ts`: "Filter and group" › "About the game" with the same sections;
  a category plus a mechanism must both match; Clear filters at the top resets everything
- [ ] T019 [US5] Extend `src/domain/filter.ts` (`Filter.game`, stored form) and
  `src/app/components/FilterPanel.tsx` ("About the game" heading, `GameFilterSections`, Clear filters at
  the top) and pass game details in `src/app/screens/Collection.tsx` (with `useGameDetails` for
  entries without details) (T018 green)

## Phase 8: Main button captions (design rule 3.3.0)

- [x] T020 [P] [MB] Write failing Playwright tests in `tests/e2e/main-button.spec.ts`: captions
  "Tinder" (shopping list), "New list" (Buy › Shopping lists), "Load list" (Lists), "Add game" (own
  status list), "Filter" (preview) inside the hexagon; accessible names unchanged; axe
- [x] T021 [MB] Add the required `caption` (and the active dot) to `MainButton` in
  `src/app/components/ActionBar.tsx` and `src/app/theme/actionbar.css` (68×76 px, icon 24 px, 10px
  caption); pass captions in `screens/Collection.tsx`, `screens/Collections.tsx`, `screens/Lists.tsx`,
  `screens/StatusList.tsx` (T020 green)

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T022 [P] Update `CLAUDE.md` (code layout: `game-filter.ts`, `useGameDetails`) and
  `docs/hosting/setup.md` (migration 0008)
- [ ] T023 Run `npm test`, `npm run build` and `npm run test:e2e`; record the results here (compare
  flakes with `main`, see memory "E2E on own port")
- [ ] T024 Apply migration 0008 (`npm run db:migrate:neon`), deploy (`npm run deploy`) and walk through
  `specs/009-list-filter/quickstart.md` with the user on the phone

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T005 needs T002/T003; T006 needs T001/T004; T007 needs T006's sync shape).
- US4 (T008–T009) before US1's reading parts (T012).
- US1 before US2 (slots in `GameFilterSections`) and US5 (reuses the sections).
- US3 and MB are independent of US1 once Phase 2 is done.
- Polish last.

## Parallel Opportunities

- T002, T003, T004 together; T008 with T010 and T011; T014, T016, T018, T020 together after US1.
- Suggested Orca Swarm split after Phase 2 on the branch: A = US4 + US1 + US2 (reader, sheet, slider:
  T008–T015), B = US3 + MB (T016, T017, T020, T021), then C = US5 (T018, T019) after A.

## Implementation Strategy

MVP = Phase 2 + US4 + US1 (filter a preview by length, players, mechanisms, designers). Then US2
sliders, US3 Config limits, US5 shopping lists and the captions; deploy after the polish run.
