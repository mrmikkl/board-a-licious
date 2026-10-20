# Tasks: Big Game Images, BGG Gallery and Show-off

**Input**: Design documents from `/specs/004-show-off-gallery/`
**Prerequisites**: plan.md, spec.md, design.md, research.md, data-model.md, contracts/images-api.md,
quickstart.md; design rules `docs/design.md` v2.1.0; ADRs 0001–0006; the code of features 001–003.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before the
code it covers and must fail first. No live BGG in tests: the worker test uses
`tests/fixtures/bgg/images-295947.json`; e2e tests fake `/api/bgg/images` with it.

**Organization**: by user story (spec.md US1 viewer and gallery, US2 Show-off).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1, US2)

## Path Conventions

As before: `src/domain/`, `src/client/`, `src/app/`, `worker/`, `tests/{unit,worker,e2e,fixtures}/`.

---

## Phase 1: Setup

- [X] T001 [P] Add `IconShowOff` (three hexagons, as in the prototype) to `src/app/components/icons.tsx`; create empty `src/app/theme/viewer.css` and `src/app/theme/showoff.css` and import them in `src/app/main.tsx` after `actionbar.css`
- [X] T002 [P] Add an e2e helper `fakeGallery(page)` to `tests/e2e/helpers.ts` that answers `**/api/bgg/images?**` from `tests/fixtures/bgg/images-295947.json` mapped to the API shape of contracts/images-api.md (main image `5100691` first, `large` = `imageurl_lg`, `small` = `imageurl`), and an empty gallery (`images: []`) for other ids

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the gallery data path (domain → Worker → client) that the viewer of both stories uses.

**⚠️ CRITICAL**: no user story work before this phase is complete.

### Tests first

- [X] T003 [P] Unit tests in `tests/unit/gallery.test.ts` for `orderGallery(mainImageId, images, fallbackMain?)` (data-model "Game gallery"): the main image moves to the front; when missing, `fallbackMain` goes first; duplicate ids dropped; "at most 50"; captions trimmed to 120 chars and empty captions → null
- [X] T004 [P] Worker tests in `tests/worker/bgg-images.test.ts` (with the BGG client fake used by `bgg-games.test.ts`): `GET /api/bgg/images?id=295947` → 200 `{ bggId, total: 600, images }` with `5100691` first and the fixture's other images in order; the upstream URL is the one of contracts/images-api.md (`gallery=game`, `sort=hot`, `showcount=50`); a second call within the TTL makes no upstream request; `id` missing or `0` → 400 `bad_request`; BGG busy → 503 `bgg_rate_limited` with `Retry-After` (as the other BGG routes); unknown game → 404

### Implementation

- [X] T005 Implement `src/domain/gallery.ts` (`GameImage`, `GameGallery`, `orderGallery`, cap `GALLERY_MAX = 50`); T003 passes
- [X] T006 Implement `worker/bgg/geekdo-images.ts` (`getGallery(client, bggId)`: cached geekitem for `imageid` and the fallback main image, the images page with TTL `TTL.game`, mapped and ordered with `orderGallery`), add `getGallery` to `BggSource` in `worker/bgg/source.ts` and `worker/bgg/geekdo.ts` (the XML source, if present, delegates to the Geekdo one: research R1), route `GET /api/bgg/images` in `worker/index.ts`; T004 passes
- [X] T007 Add `getGallery(bggId)` to `src/client/api.ts` with a session cache (`Map` by `bggId`, research R3) and the existing `ApiError` handling

**Checkpoint**: the app can ask for a game's gallery; repeated asks hit memory, then the server cache.

---

## Phase 3: User Story 1 - See a game's image big and swipe through its gallery (Priority: P1) 🎯 MVP

**Goal**: tap the cover in a details sheet → full-screen viewer; swipe through the gallery; ✕, Back, Esc, swipe down close (FR-001–FR-006, FR-002a).

**Independent Test**: collection → Cascadia → tap the cover: big image "1 / 8"; swipe left twice: "3 / 8"; swipe down: back in the details sheet.

### Tests for User Story 1

- [X] T008 [P] [US1] Unit tests in `tests/unit/viewer-gesture.test.ts` for the pure gesture module (research R5): axis lock after 8px; horizontal drag offset follows dx, ⅓ past the first/last image; release → `step(+1/−1)` when |dx| > 50 or flick > 0.5 px/ms, else `settle`, never past the ends; vertical drag down → offset and backdrop opacity; release → `close` when dy > 100 or flick down; two pointers (pinch) → `ignore`
- [X] T009 [P] [US1] Failing Playwright tests in `tests/e2e/viewer.spec.ts` (with `fakeBgg`, `fakeGallery`; contracts/images-api.md "Viewer"): in a collection, Cascadia's details sheet has the button "Show the images of Cascadia big"; it opens dialog "Images of Cascadia" with "1 / 8" and the first image's alt "Cascadia, image 1 of 8"; ArrowRight twice → "3 / 8"; swipe (mouse drag) right at "1 / 8" stays on "1 / 8" and the first image is fully in view; the dialog element is the same before and after a step (no re-mount, FR-002a); Esc, "Close" and `page.goBack()` each close it and the details sheet is still open; a game without gallery (empty images) shows the cover big, no position, the note; offline (`context.setOffline(true)` before opening another game) shows the cover and "once you are back online"; a BGG list's game sheet opens the same viewer; axe clean with the viewer open; in `phone-reduced-motion` no running animations in the viewer

### Implementation for User Story 1

- [X] T010 [US1] Implement `src/app/viewer-gesture.ts` (pure; no DOM); T008 passes
- [X] T011 [US1] Create `src/app/components/ImageViewer.tsx` (docs/design.md "Image viewer"): modal dialog "Images of <game>", top row name, live "i / n", "Close"; a track of slides moved by `transform` only, stable keys, the component stays mounted while stepping; each slide shows `small` (or the cover) until `large` has loaded, neighbours ±1 preloaded; hexagon dots (≤ 12), caption "<caption or 'Image i'> · from BoardGameGeek"; ‹ › on pointer devices; keys ←/→/Esc; pointer events through `viewer-gesture.ts`; opens with `history.pushState`, closes on `popstate`, ✕/Esc/swipe-down call `history.back()` (research R6); focus into the dialog and back to the cover on close; single image → note (offline: "You are offline: more images of this game once you are back online.", none: "BoardGameGeek has no more images of this game.", details pending: "No images yet: they follow once BoardGameGeek details are loaded.")
- [X] T012 [US1] Styles in `src/app/theme/viewer.css` (opaque `#05060E`, 180ms fade-in, 280ms slide, drag without transition, dots, caption, ‹ › hidden on touch, none of the motion under `prefers-reduced-motion`)
- [X] T013 [US1] In `src/app/components/GameSheet.tsx` and `src/app/components/MembershipSheet.tsx` (a BGG list's game sheet), make the cover a button "Show the images of <game> big" with the ⤢ badge (styles in `viewer.css`) that opens `ImageViewer` with `getGallery`; T009 passes

**Checkpoint**: every details sheet's cover opens the viewer with the gallery; MVP.

---

## Phase 4: User Story 2 - Show-off: a honeycomb of the games you picked (Priority: P2)

**Goal**: Show-off action → group sheet (remembered) → honeycomb screen → viewer (FR-007–FR-014).

**Independent Test**: collection → Show-off → only Must Have → Show off: honeycomb of the Must Have covers; tap one: viewer; close: honeycomb; ‹: collection.

### Tests for User Story 2

- [X] T014 [P] [US2] Unit tests: `showOffGames(entries, groups, nameOf)` in `tests/unit/collection-view.test.ts` ("in the collection group order (must_have, interested, unsure, poop, new, skip), by name within a mark", deleted entries left out); routes in `tests/unit/router.test.ts`: `#/collections/c1?show-off` ↔ `{ name: 'collection', id: 'c1', open: 'showoff' }`, `#/collections/c1/show-off/must_have,interested` ↔ `{ name: 'showoff', id: 'c1', groups: ['must_have', 'interested'] }`, unknown marks dropped, no valid mark → `{ name: 'collection', id: 'c1' }`
- [X] T015 [P] [US2] Failing Playwright tests in `tests/e2e/show-off.spec.ts` (contracts/images-api.md "Show-off"): the action bar order is Add game, ♥, Filter, Show-off; Show-off opens dialog "Show-off" with six toggle buttons (counts shown), Must Have pressed the first time, "Show off" disabled with none pressed; choosing Must Have + Interested and "Show off" opens the screen: `h1` "Show-off", "<collection> · ⭐ 👀 · <n> games", one button "<game>, <mark>" per game in order, three in the first row and the second row shifted right by half a hexagon (bounding boxes), the bought game shows ✓; a hexagon opens the viewer, closing returns to the honeycomb, "Back" returns to the collection; Show-off again preselects Must Have + Interested; groups without games show "No game in these groups" and "Choose groups" opens the sheet; works offline after the collection was loaded; axe clean; reloading the screen's address shows the same honeycomb

### Implementation for User Story 2

- [X] T016 [US2] Implement `showOffGames` in `src/domain/collection.ts`, the routes in `src/app/router.ts` and the screen case in `src/app/App.tsx`, and the meta key `showOff: Record<string, Mark[]>` in `src/client/store.ts` (data-model "Show-off choice": "missing → ['must_have']; unknown marks ignored"); T014 passes
- [X] T017 [US2] Create `src/app/components/ShowOffSheet.tsx` (multi-choice toggles with emoji, label, count and hexagon tick, updated in place; Cancel / Show off; saves the choice to `showOff` and navigates to the screen) and add the Show-off action at the outer right of the collection's action bar in `src/app/screens/Collection.tsx` (an `outer` slot in `src/app/components/ActionBar.tsx` and `src/app/theme/actionbar.css`, column 5), opened by `?show-off`
- [X] T018 [US2] Create `src/app/screens/ShowOff.tsx` (back to the collection, heading, marks line, honeycomb of hexagon buttons with lazy covers or initials and the ✓ badge, empty state, the image viewer on tap) and its styles in `src/app/theme/showoff.css` (research R8: `w = (column − 3·gap) / 3.5`, height `w·1.1547`, rows overlap `−0.2887·w + gap`, odd rows shifted `(w + gap) / 2`); T015 passes

**Checkpoint**: Show-off works on its own and opens the viewer of US1.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Accessibility: extend `tests/e2e/a11y.spec.ts` with axe, focus and reduced-motion checks for the viewer, the Show-off sheet and the Show-off screen (SC-006)
- [ ] T020 [P] Docs: mention `GET /api/bgg/images` where the API routes are listed (e.g. `specs/001-bgg-game-collection/contracts` index or README if they list routes); update `CLAUDE.md` "Code layout" only if a new folder appears
- [X] T021 Run `npx tsc -b`, `npm test`, `npm run test:e2e` (fresh local DB, docs/orca-swarm.md), `npm run build`; fix what fails
  *Result (2026-10-21, fresh local database)*: `tsc` clean, 361 unit and worker tests, build, e2e 129/129.
- [ ] T022 Quickstart validation on a phone (quickstart.md scenarios 1–11) after deploying

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: T001 ∥ T002.
- **Foundational (Phase 2)**: T003 ∥ T004 first; T005 before T006 (the Worker uses `orderGallery`); T007 after T006's API shape. Blocks both stories.
- **US1 (Phase 3)**: after Phase 2. MVP.
- **US2 (Phase 4)**: after Phase 2; its viewer step (T018 tapping a hexagon) needs T011. T014–T017 can run beside US1.
- **Polish**: after both stories.

### Within Each Phase

- Tests first, failing; then implementation.
- `src/app/screens/Collection.tsx` is touched only by T017; `src/app/router.ts` only by T016.

### Parallel Opportunities

- T001 ∥ T002; T003 ∥ T004; T008 ∥ T009 ∥ T014 ∥ T015; T019 ∥ T020.
- US2's T014, T016, T017 in parallel with US1's T010–T013 (different files); T018 joins after T011.

---

## Parallel Example: Foundational

```text
Task: "T003 Unit tests for orderGallery in tests/unit/gallery.test.ts"
Task: "T004 Worker tests for GET /api/bgg/images in tests/worker/bgg-images.test.ts"
```

---

## Implementation Strategy

### MVP First

Setup → Foundational → US1: every cover opens big with the BGG gallery; deployable on its own.

### Incremental Delivery

1. Foundational: gallery data path.
2. US1: image viewer.
3. US2: Show-off.
4. Polish, full test run, deploy, phone check.

## Notes

- Commit after each task or logical group (`F004 T0xx: …`, docs/commit-conventions.md).
- The prototype is a reference for look and gestures, not code to copy.
