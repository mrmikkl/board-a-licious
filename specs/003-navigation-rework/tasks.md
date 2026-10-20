# Tasks: Navigation Rework with a Context-Aware Main Button

**Input**: Design documents from `/specs/003-navigation-rework/`
**Prerequisites**: plan.md, spec.md, design.md, research.md, data-model.md, contracts/navigation.md,
quickstart.md; design rules `docs/design.md` v2.0.0; ADRs 0001–0006; the code of features 001/002.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before the
code it covers and must fail first. Existing e2e specs that use the tab bar, the `#/add` screen,
"Add by list", "Collection options" or the collection's back button are moved to the new controls
in the story that removes the old ones (research R8), keeping what they assert about behaviour.

**Organization**: by user story (spec.md US1–US4). No server, database, API or `src/client/` change.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US4)

## Path Conventions

As features 001/002: `src/domain/`, `src/app/`, `tests/{unit,e2e}/`, plus `vite.config.ts`,
`index.html`, `public/icons/`, `scripts/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: icons and test helpers every story uses.

- [X] T001 [P] Write `scripts/make-icons.mjs` (research R6): with the Playwright Chromium (`@playwright/test`, already a dev dependency) read `specs/003-navigation-rework/design/icons/Hexagon Icons/hex-gradient-colour.png` and `Favicons/favicon-color.png`, trim transparent margins and write `public/icons/logo.png` (120px wide), `icon-192.png`, `icon-512.png` (transparent corners, `purpose: any`), `icon-maskable-512.png` (the hexagon at 80% on a full `#0D0F1F` square, inside the maskable safe zone), `apple-touch-icon.png` (180px on `#0D0F1F`) and `favicon.png` (48px); run it and commit `public/icons/`
- [X] T002 [P] Add e2e helpers to `tests/e2e/helpers.ts` (research R8, contracts/navigation.md): `openMenu(page)`, `goTo(page, 'Collections' | 'BGG lists' | 'Search' | 'Config')` (☰ "Menu" → link in `nav` "Menu"), `mainButton(page)` (the action bar's main button), `createCollection(page, name)` (Collections → main ＋ → Name → Create collection), `loadList(page, link)` (BGG lists → main ＋ → link → Load list)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the routes that open sheets and the redirects of the old add screen; US2 and US3 need them.

**⚠️ CRITICAL**: no user story work before this phase is complete.

- [X] T003 Unit tests in `tests/unit/router.test.ts` (data-model "Routes", contracts/navigation.md "Sheets opened by routes", "Old addresses"): `#/collections?new` → `{ name: 'collections', create: true }`; `#/lists?load` → `{ name: 'lists', load: true }`; `#/collections/<id>?add=game` / `?add=list` → `{ name: 'collection', id, open: 'game' | 'list' }`; `href` round-trips each; `#/add` → collections, `#/add/collection` → collections create, `#/add/list` → lists load, `#/add/game` → collections; existing routes (swipe with list, list, shared with query, config/share) unchanged
- [X] T004 Implement the query flags in `src/app/router.ts` (parse and `href`) and the `#/add…` redirects; remove the `add` route from the `Route` type; T003 passes (`tsc` will flag `Add.tsx`, `TabBar.tsx` and the `href({ name: 'add' … })` links: give them temporary targets per contracts/navigation.md "Links that pointed at the add screen" so the build stays green until US1/US2 remove them)

**Checkpoint**: every sheet the old add screen offered has an address; old links still land somewhere sensible.

---

## Phase 3: User Story 1 - Navigate with the app bar and its menu (Priority: P1) 🎯 MVP

**Goal**: app bar (logo, "Board-a-licious", ☰) and menu on every screen; the tab bar is gone (FR-001–FR-005, FR-019a).

**Independent Test**: open the app, open the menu, go to each of the four places and back to Collections; no bottom navigation bar anywhere.

### Tests for User Story 1

- [X] T005 [P] [US1] Failing Playwright tests in `tests/e2e/navigation.spec.ts` ("US1"): on Collections, a collection, BGG lists, a list, Swipe, Search, Config and Share and backup the app bar shows the logo (decorative), the text "Board-a-licious" and a button "Menu"; no `nav` "Main" (tab bar) exists; ☰ sets `aria-expanded="true"` and shows `nav` "Menu" with links Collections, BGG lists, Search, Config in this order, the current place `aria-current="page"` (a collection → Collections, a list → BGG lists, Share and backup → Config); choosing "BGG lists" opens it and closes the menu; Esc and a scrim tap close it without navigating and focus returns to ☰; back button "Back" only on a list, Swipe and Share and backup, none on a collection (FR-002); every place reachable in 2 taps (SC-001)
- [X] T006 [P] [US1] Failing Playwright test in `tests/e2e/share-offline.spec.ts` (project `offline`, built app): the manifest's `icons` are `/icons/icon-192.png` (192x192, any), `/icons/icon-512.png` (512x512, any), `/icons/icon-maskable-512.png` (512x512, maskable) and each loads as a PNG; the page links `/icons/favicon.png` and `/icons/apple-touch-icon.png` (FR-019a, contracts/navigation.md "Icons")

### Implementation for User Story 1

- [X] T007 [P] [US1] Add `IconMenu` (☰), `IconHeart`, `IconPencil` to `src/app/components/icons.tsx`
- [X] T008 [US1] Create `src/app/components/Menu.tsx` (research R2): `nav` "Menu" with a list of links (Collections, BGG lists, Search, Config; `aria-current="page"` by place as in contracts/navigation.md "Menu"), scrim; focus to the current link on open; Esc, scrim tap and choosing a link call `onClose`
- [X] T009 [US1] Create `src/app/components/AppBar.tsx`: logo `<img src="/icons/logo.png" alt="">`, the text "Board-a-licious", ☰ button "Menu" with `aria-expanded`/`aria-controls`; renders `Menu` while open; closes on route change; focus back to ☰ on Esc/scrim
- [X] T010 [US1] Styles in `src/app/theme/shell.css` (docs/design.md v2.0.0 "App bar", "Menu"): sticky orange band (hot gradient, ~48px, dark name in Chakra Petch 19px, 34px logo, 38px translucent ☰ with a ≥ 44px touch area), menu panel below the app bar at the right (rows ≥ 48px, raised current row with orange icon), scrim, 180ms grow-in, none under `prefers-reduced-motion`; remove `.tabbar`, `.tab`, `.logo` letter styles that are no longer used
- [X] T011 [US1] In `src/app/App.tsx`: the shell renders `SignInBanner`, `AppBar`, the screen; remove `TabBar` (delete `src/app/components/TabBar.tsx`); the boot screens use `AppBar` too
- [X] T012 [US1] Turn `src/app/components/Header.tsx` into the screen heading (docs/design.md §6 "Screen heading"): `h1` title, optional back link before it, optional trailing element after it; no logo; drop the `lead` prop; update callers: no back on Collections, Collection, BGG lists, Search, Config; back on List, Swipe, Share and backup (`src/app/screens/*.tsx`)
- [X] T013 [US1] Manifest and page icons: `icons` in `vite.config.ts` (192/512 any, 512 maskable from `public/icons/`), `<link rel="icon" href="/icons/favicon.png">` and `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">` in `index.html`; delete `public/icon.svg`; T006 passes
- [X] T014 [US1] Move the e2e specs that navigate with the tab bar to `goTo` (T002): `tests/e2e/developer.spec.ts`, `a11y.spec.ts`, `intro.spec.ts`, `share-offline.spec.ts`, `share-target.spec.ts`, `ui-tweaks.spec.ts`, `signin.spec.ts`, `us2-lists.spec.ts`, `us5-share.spec.ts`; T005 and these pass

**Checkpoint**: navigation works only through the menu; the old + button is gone (adding still works through the screens' existing buttons and cards until US2).

---

## Phase 4: User Story 2 - A main button that follows the screen (Priority: P1)

**Goal**: the action bar with the context-aware main button; the add screen, the create/load cards and "Add by list" go away (FR-006–FR-014, FR-019).

**Independent Test**: Collections ＋ → create "Test"; ♥ → BG-Tinder → pick a list → swipe one game right; BGG lists ＋ → paste a link → the list opens; Search 🔍 disabled; Config has no bottom area.

### Tests for User Story 2

- [X] T015 [P] [US2] Failing Playwright tests in `tests/e2e/navigation.spec.ts` ("US2", contracts/navigation.md "Action bar and main button per screen", "Sheets opened by routes"): Collections main button "Create a collection" → sheet "New collection" (Cancel / Create collection) → the new collection opens, Back from the open sheet closes it; no "Create a collection" card; collection main button "BG-Tinder: swipe a BGG list into this collection" → sheet "❤️ BG-Tinder ❤️" → Select → Swipe for that list; with no list loaded the sheet offers loading one; BGG lists main button "Load a BGG list" → sheet with the link field, invalid link shows the hint and keeps "Load list" disabled, valid link opens the list; no "Load a BGG list" card or button on the screen; Search main button "Search (not available yet)" is disabled; Config, a list, Swipe, Share and backup have no action bar; `#/add/list` opens BGG lists with the load sheet, `#/add` opens Collections; Share and backup's and the membership sheet's "Create a collection" open the New collection sheet; a failed list's "Load a BGG list" opens the load sheet; no `.btn-primary` inside any screen heading or the app bar (FR-019); the toast shows above the action bar

### Implementation for User Story 2

- [X] T016 [US2] Create `src/app/components/ActionBar.tsx` (research R1, docs/design.md "Action bar", "Main button"): `<nav aria-label="Actions">` with a 5-column row, `MainButton` (hot hexagon, icon, accessible name, `disabled` support) in column 3 and optional actions (icon + label, ≥ 52px) placed left or right of it; styles in `src/app/theme/shell.css` (dock position and safe area from the old tab bar, shimmer every 5 s, disabled raised grey without shimmer, 560px centred from 768px); `.app` bottom padding only while an action bar is shown, toast above it or near the bottom without (research R7)
- [X] T017 [US2] `src/app/screens/Collections.tsx`: action bar with main ＋ "Create a collection" → `#/collections?new`; a "New collection" sheet (Name via `NewCollectionForm`, Cancel / Create collection) open while `route.create`, closing replaces the route without the query; remove the "Create a collection" card; the empty state "No collections yet" points to ＋ below
- [X] T018 [US2] `src/app/screens/Lists.tsx`: action bar with main ＋ "Load a BGG list" → `#/lists?load`; a "Load a BGG list" sheet (link field and hints moved from `ListForm` in `src/app/screens/Add.tsx`, Cancel / Load list) open while `route.load`; remove the "Load a BGG list" card and the empty state's button; the empty state points to ＋ below with the SPIEL preview example
- [X] T019 [US2] `src/app/screens/Collection.tsx` and `src/app/components/ListPicker.tsx`: action bar with main ♥ "BG-Tinder: swipe a BGG list into this collection" → `?add=list`; `route.open` opens `ListPicker` (list) or the Add game sheet (game), closing replaces the route; `ListPicker` title "❤️ BG-Tinder ❤️"; remove the "Add by list" buttons (tool row and empty state)
- [X] T020 [P] [US2] `src/app/screens/Search.tsx`: action bar with the disabled main 🔍 "Search (not available yet)"; remove the add-game link
- [X] T021 [US2] Replace the remaining links to the add screen (contracts/navigation.md "Links that pointed at the add screen"): `src/app/screens/Share.tsx`, `src/app/screens/List.tsx`, `src/app/components/MembershipSheet.tsx` → `#/collections?new` / `#/lists?load`; `src/app/screens/Shared.tsx` "Add game by link" → `#/collections/<last share collection>?add=game` (else `#/collections?new`); delete `src/app/screens/Add.tsx` and its case in `src/app/App.tsx`; keep `HexPicker` (used by `GameSheet`)
- [X] T022 [US2] Move the e2e specs that use the add screen or "Add by list" to the main buttons and helpers (T002): `tests/e2e/a11y.spec.ts`, `add-sheets.spec.ts`, `game-info.spec.ts`, `group-by.spec.ts`, `lists-sync.spec.ts`, `share-offline.spec.ts`, `share-sheet.spec.ts`, `share-target.spec.ts`, `ui-tweaks.spec.ts`, `us2-lists.spec.ts`, `us3-swipe.spec.ts`; T015 and these pass

**Checkpoint**: each screen's one orange action is its main button; every 001/002 journey works through menu and main button (SC-005).

---

## Phase 5: User Story 3 - A collection's actions at the bottom, editing at its name (Priority: P2)

**Goal**: Add game · ♥ · Filter at the bottom, pencil → Edit collection, ticker for long names, no tool row (FR-015, FR-015a, FR-015b, FR-016).

**Independent Test**: a collection with games shows Add game, ♥, Filter at the bottom and only the name with ✏️ at the top; each opens its sheet; a long name runs.

### Tests for User Story 3

- [X] T023 [P] [US3] Failing Playwright tests in `tests/e2e/collection-actions.spec.ts` ("US3"): action bar order Add game, main ♥, Filter; Add game (plus icon) opens "Add game"; Filter opens "Filter and group", while narrowed its name ends in "(active)" and the summary line stays above the games; no tool row, no "Collection options", no back button; ✏️ "Edit <name>" opens "Edit collection": Save name renames (toast "Renamed to …"), Delete collection… asks and deletes; an empty collection explains the heart and Add game and shows the same action bar; a 60-character name: heading has class `is-long` and a running animation, ✏️ stays visible at the right; in project `phone-reduced-motion` the name has no animation and ends in "…" (computed `text-overflow: ellipsis`)

### Implementation for User Story 3

- [X] T024 [P] [US3] Create `src/app/components/Ticker.tsx` (research R4): renders the text in an inner span inside the `h1`; `ResizeObserver` sets `is-long`, `--ticker-shift`, `--ticker-time` (shift / 50px per s / 0.64, at least 4 s); styles in `src/app/theme/shell.css` (keyframes hold 18% / move / hold 18%, edge fades with `mask-image`, reduced motion: no animation, `text-overflow: ellipsis`)
- [X] T025 [US3] `src/app/screens/Collection.tsx`: heading = `Ticker` with the name + trailing ✏️ button "Edit <name>"; action bar: Add game (`IconPlus`, left of ♥), ♥, Filter (right, orange icon and "(active)" while narrowed); remove the collection tool row, the wide-only header buttons and ⋯; rename `CollectionMenu` to an "Edit collection" sheet (Name, Save name, Delete collection… with the existing confirmation, Cancel); empty-state text for ♥ and Add game; remove `.collection-tools`, `.phone-only`, `.wide-only` from `src/app/theme/components.css` if unused
- [X] T026 [US3] Move the e2e specs that use "Collection options" or the collection's tool row to ✏️ and the action bar: `tests/e2e/us5-share.spec.ts`, `ui-tweaks.spec.ts` (and any other spec still clicking the tool row); T023 and these pass

**Checkpoint**: the top of a collection is only its name; everything to do with it is at the bottom or behind ✏️.

---

## Phase 6: User Story 4 - "Not yet marked" folds and sits above "Not interested" (Priority: P2)

**Goal**: groups Must Have, Interested, Unsure, Poop, separator, Not yet marked (folds, open), Not interested (folds, closed) (FR-017, FR-018, FR-018a).

**Independent Test**: a collection with every mark shows the new order and the line; tapping "Not yet marked" hides and shows its games.

### Tests for User Story 4

- [X] T027 [P] [US4] Unit tests in `tests/unit/collection-view.test.ts` (data-model "Collection groups"): `groupByMark` returns the order must_have, interested, unsure, poop, new, skip with `part` 'marked' for the first four and 'rest' for new and skip; empty groups left out; games sorted by name; `MARKS` order unchanged (new first)
- [X] T028 [P] [US4] Failing Playwright tests in `tests/e2e/collection-actions.spec.ts` ("US4"): group headings in the new order; one separator between the last marked group and "Not yet marked" (none when only one part has games); "Not yet marked" is a fold button, expanded on open, collapses and expands with its count visible; "Not interested" starts collapsed; the mark picker on a game keeps its order (Not yet marked first)

### Implementation for User Story 4

- [X] T029 [US4] Change `groupByMark` in `src/domain/collection.ts` to the collection order with `part`; T027 passes
- [X] T030 [US4] `src/app/screens/Collection.tsx` and `src/app/components/GroupHeading.tsx`: the separator before the first 'rest' group after a 'marked' one; Not yet marked folds (open by default) like Not interested (closed by default), state not remembered; T028 passes

**Checkpoint**: all four stories work on their own and together.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T031 [P] Accessibility: extend `tests/e2e/a11y.spec.ts` with axe on every screen with the menu open, with each new sheet open (New collection, Load a BGG list, Edit collection, ❤️ BG-Tinder ❤️) and with the disabled main button (SC-006)
- [X] T032 [P] Docs: remove leftover tab bar / "+" / add-screen wording from `docs/design.md` (e.g. §12 Onboarding "shown again from the collections screen" → from Config), `docs/vision.md` and `README.md` if they describe the old navigation; record the icon script in `CLAUDE.md` "Commands"
- [X] T033 Run `npx tsc -b`, `npm test`, `npm run test:e2e`, `npm run build`; fix what fails
  *Result (2026-10-20, fresh local database)*: `tsc` clean, 332 unit tests, build, e2e 116/117; the
  one failure is `offline.spec.ts`, which fails 2 of 8 repeats on `main` too (pre-existing flake).
- [ ] T034 Quickstart validation on a phone (quickstart.md scenarios 1–14), including installing the app to see the new home-screen icon

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none; T001 and T002 in parallel.
- **Foundational (Phase 2)**: after Setup; blocks all stories.
- **US1 (Phase 3)**: after Phase 2. MVP.
- **US2 (Phase 4)**: after US1 (the action bar sits in the shell US1 builds; e2e helpers rely on the menu).
- **US3 (Phase 5)**: after US2 (same `Collection.tsx`, needs the action bar).
- **US4 (Phase 6)**: domain part (T027, T029) can start right after Phase 2; T028/T030 after US3 (same `Collection.tsx`).
- **Polish (Phase 7)**: after all stories.

### Within Each Phase

- Tests first, failing; then implementation; then the moved e2e specs.
- `Collection.tsx` is touched by T019, T025, T030: strictly in that order.

### Parallel Opportunities

- T001 ∥ T002; T005 ∥ T006 ∥ T007; T015 ∥ T020; T023 ∥ T024; T027 ∥ T028 ∥ (US3 work); T031 ∥ T032.
- The domain change of US4 (T027 → T029) can run beside US1–US3 in another worktree.

---

## Parallel Example: User Story 1

```text
Task: "T005 Failing Playwright tests in tests/e2e/navigation.spec.ts (US1)"
Task: "T006 Failing manifest icon test in tests/e2e/share-offline.spec.ts"
Task: "T007 Add IconMenu, IconHeart, IconPencil to src/app/components/icons.tsx"
```

---

## Implementation Strategy

### MVP First

Setup → Foundational → US1: the app bar and menu replace the tab bar; deployable on its own.

### Incremental Delivery

1. US1: navigation through the menu.
2. US2: the main button per screen (removes the add screen).
3. US3: the collection's bottom actions, pencil and ticker.
4. US4: group order, separator, folding.
5. Polish, full test run, phone check, deploy.

## Notes

- Commit after each task or logical group (`F003 T0xx: …`, docs/commit-conventions.md).
- The prototype (`design/prototype.html`) is a reference for look and flows, not code to copy.
