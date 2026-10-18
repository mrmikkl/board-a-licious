# Tasks: Share from BGG into the App

**Input**: Design documents from `/specs/002-share-from-bgg/`
**Prerequisites**: plan.md, spec.md, design.md, research.md, data-model.md, contracts/, quickstart.md;
design rules `docs/design.md` v1.9.0; ADRs 0001–0006; the code of feature 001.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before
the code it covers and must fail first. No BGG requests in tests; shares are simulated by opening
the entry URL `/share-target?…` (contracts/share-target.md).

**Organization**: by user story (spec.md US1–US3), so each story can be built, tested and shown on
its own. No server, database or API changes in this feature.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US3)

## Path Conventions

As feature 001: `src/domain/`, `src/client/`, `src/app/`, `tests/{unit,e2e,fixtures}/`, plus
`vite.config.ts` for the manifest.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the app announces itself as a share target.

- [ ] T001 Write a failing Playwright test in `tests/e2e/share-target.spec.ts` (project `phone`, against `vite preview`) that fetches `/manifest.webmanifest` and expects `share_target` = `{ action: "/share-target", method: "GET", params: { title: "title", text: "text", url: "url" } }` (contracts/share-target.md)
- [ ] T002 Add `share_target` to the PWA manifest in `vite.config.ts` (method GET, action `/share-target`, params title/text/url); `start_url`, `scope`, `display: "standalone"` unchanged; T001 passes

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: reading a share and getting it into the app; every story needs this.

**⚠️ CRITICAL**: no user story work before this phase is complete.

### Tests first

- [ ] T003 [P] Unit tests for `readShare({ title, text, url })` in `tests/unit/shared.test.ts` (research R4, data-model "Share reading"): game link in `url`; game link inside `text` with words around it ("Check out Cascadia on BoardGameGeek: https://boardgamegeek.com/boardgame/295947/cascadia"); expansion link (`/boardgameexpansion/<id>`); `url` wins over `text` and `text` over `title`; preview and geeklist links → `{ kind: "list", ref }`; blog post, forum thread, non-BGG link and empty input → `{ kind: "none", shown }` with `shown` "the first link, else the text, trimmed to 200 chars"; suggested name from the title with BGG suffixes removed ("Cascadia | Board Game | BoardGameGeek" → "Cascadia"), else short plain text before the link, else the slug name, "never empty (falls back to the slug name, then "Game <id>")"
- [ ] T004 [P] Failing Playwright test in `tests/e2e/share-target.spec.ts`: opening `/share-target?text=<game link>` ends on `/#/shared?…` (history replaced: Back does not return to `/share-target`), and a reload of that page does not share twice; opening `/share-target` offline (project `offline`) shows the app, not an error page (research R2)

### Implementation

- [ ] T005 Implement `readShare` in `src/domain/shared.ts` reusing `parseGameLink` (`src/domain/bgg-link.ts`) and `parseListLink` (`src/domain/lists.ts`); pure, no DOM; T003 passes
- [ ] T006 Add the route `{ name: "shared"; title?: string; text?: string; url?: string }` to `src/app/router.ts` (`#/shared?title=…&text=…&url=…`, parse and `href`), and the tab mapping in `src/app/components/TabBar.tsx` (shared → collections)
- [ ] T007 Implement `src/app/share-target.ts`: on boot, before the router reads the hash, if `location.pathname === "/share-target"` read `title`, `text`, `url` and `history.replaceState` to `/#/shared?…`; call it first in `src/app/main.tsx`; T004 passes
- [ ] T008 Add the meta key `lastShareCollection: string` to `MetaValues` in `src/client/store.ts` (data-model: "set after each successful add from a share; ignored when that collection no longer exists or was deleted")

**Checkpoint**: a share opens the app on `#/shared` with its parameters, online and offline.

---

## Phase 3: User Story 1 - Share a game from BGG into a collection (Priority: P1) 🎯 MVP

**Goal**: BGG → Share → board-a-licious → the Shared game sheet → Add to collection (FR-001–FR-008, FR-012).

**Independent Test**: open `/share-target?text=…/boardgame/295947/cascadia`, tap Add to collection: Cascadia is in the preselected collection under Not yet marked.

### Tests for User Story 1

- [ ] T009 [US1] Playwright tests in `tests/e2e/share-target.spec.ts` (fail first), each with its own fresh collections (`unique()` names, shared dev database): sheet "Add game" over the collection shared into last, name and cover, dropdown labelled "Collection" with the last used option marked "(last used)" and the hint "Preselected: the collection you last shared into"; Add to collection → that collection, the new row under Not yet marked with the just-added highlight, toast "Added <game> to <collection>"; choosing another collection → added there and preselected on the next share; game already in the chosen collection → option "(already in it)", red hint "<Game> is already in <collection>. Pick another collection.", button disabled, enabled after choosing another; Cancel → nothing added; changing the dropdown keeps the same sheet element (no slide replay); no collection yet (new person or none left) → "Collection name" prefilled "SPIEL 2026", Create and add → new collection with the game; a blog link → sheet "Not a BoardGameGeek game" with the shared link, Close and "Add game by link"; axe clean on each sheet; reduced-motion project too

### Implementation for User Story 1

- [ ] T010 [P] [US1] Just-added highlight for game rows in `src/app/components/GameRow.tsx` and `src/app/theme/components.css` (docs/design.md v1.9.0 Motion "Just added": the orange border and glow of the hover state until the user scrolls or taps elsewhere); the collection screen passes the id of the row just added (from the navigation after a share)
- [ ] T011 [US1] Implement `src/app/components/SharedGameSheet.tsx` (docs/design.md "Shared game", "Choosing a collection"; design.md screens): hexagon cover (`HexCover`, known game data if the device has it) beside the editable name ("Name", trimmed, empty means the suggested name) and "Shared from BoardGameGeek"; native `select` "Collection" in the field look with "(last used)" / "(already in it)" markers; one hint line updated in place (no re-mount of the sheet); Cancel / Add to collection, disabled while the game is in the chosen collection; on add call `addGameByLink` (`src/app/actions.ts`), set `lastShareCollection`, navigate (history replaced) to the collection with the just-added id and show the toast
- [ ] T012 [US1] Add the no-collection variant to `SharedGameSheet.tsx`: "A game goes into a collection, and you have none yet. Create one, and <game> goes straight into it.", "Collection name" prefilled "SPIEL 2026" (1–60 characters, 001's rule), Create and add → `createCollection` then `addGameByLink`
- [ ] T013 [P] [US1] Implement the "Not a BoardGameGeek game" sheet in `src/app/components/NotAGameSheet.tsx`: one line why nothing can be added, the shared text/link (`shown`), Close (to the screen behind, history replaced) and Add game by link (opens the collection's Add game sheet with an empty link)
- [ ] T014 [US1] Implement `src/app/screens/Shared.tsx` and wire it in `src/app/App.tsx`: `readShare` on the route params; game → the collection from `lastShareCollection` (else the first collection by name; none → the collections screen) rendered behind `SharedGameSheet`; none → the same background with `NotAGameSheet`; T009 passes

**Checkpoint**: sharing a game adds it in at most two taps; all US1 e2e tests green.

---

## Phase 4: User Story 2 - Share while offline or signed out (Priority: P2)

**Goal**: a shared game is never lost (FR-009, SC-003).

**Independent Test**: offline project: share and add → in the collection at once with "Details follow from BoardGameGeek"; back online → synced.

### Tests for User Story 2

- [ ] T015 [US2] Playwright tests in `tests/e2e/share-target.spec.ts` (project `offline`, fail first): offline share shows the framed note "You are offline: the game is added on this phone now; its cover and details follow once you are back online.", adding works and the row shows "Details follow from BoardGameGeek"; after going online the entry reaches the server (`/api/sync`); with the API answering 401 the game is added locally and the "Sign in again" banner shows

### Implementation for User Story 2

- [ ] T016 [US2] Show the offline note in `SharedGameSheet.tsx` while `navigator.onLine` is false (updates on `online`/`offline` events); everything else is 001's local-first add, outbox and banner; T015 passes

**Checkpoint**: US1 and US2 green, offline included.

---

## Phase 5: User Story 3 - Share a BGG list into the app (Priority: P3)

**Goal**: a shared preview or geeklist opens that list (FR-010).

**Independent Test**: open `/share-target?url=https://boardgamegeek.com/geekpreview/93/spiel-essen-2026` → the list screen of preview 93, loading.

- [ ] T017 [US3] Playwright test in `tests/e2e/share-target.spec.ts` (fail first, BGG lists answered from 001's fixtures): shared preview link → `#/lists/preview/93` with the list loading; shared geeklist link → `#/lists/geeklist/<id>`
- [ ] T018 [US3] In `src/app/screens/Shared.tsx`, a `list` result navigates (history replaced) to the list route; T017 passes

**Checkpoint**: all three stories green.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 Playwright test (fail first) in `tests/e2e/share-target.spec.ts`: Config in a browser tab shows the "📲 Share from BoardGameGeek" card at the top; with `display-mode: standalone` emulated it is absent (FR-011, research R6)
- [ ] T020 Implement the Share hint card in `src/app/screens/Config.tsx` (docs/design.md v1.9.0 "Share hint", shown while `matchMedia("(display-mode: standalone)")` does not match); T019 passes
- [ ] T021 [P] Record real share texts as fixtures in `tests/fixtures/shares/` (≥ 10 game links from the BGG Android app and ≥ 10 from Chrome, SC-002) and run them through `readShare` in `tests/unit/shared.test.ts`; adjust the name rules if real texts differ (research R4 open point)
- [ ] T022 [P] Add sharing to the docs: README feature list, `docs/hosting/setup.md` (after deploying: open the app from its icon so Chrome refreshes it; reinstall if board-a-licious is missing from the share menu)
- [ ] T023 Run `npx tsc --noEmit`, `npm test`, `npm run test:e2e` (all projects green), deploy, and walk through the 10 scenarios of `quickstart.md` on the phone; note the results there

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup; blocks all stories.
- **US1 (Phase 3)**: after Phase 2. MVP.
- **US2 (Phase 4)** and **US3 (Phase 5)**: after Phase 2; US2 builds on US1's sheet (T011), US3 only on `Shared.tsx` (T014).
- **Polish (Phase 6)**: T019–T020 and T022 any time after Phase 2; T021 needs real share texts from the user; T023 last.

### Within Each Phase

- Tests first and failing (T001, T003–T004, T009, T015, T017, T019), then the code that makes them pass.
- `SharedGameSheet.tsx` before `Shared.tsx` (T011–T012 before T014).

### Parallel Opportunities

- T003 and T004 (different files).
- T010 and T013 next to T011–T012 (different files).
- T021 and T022 next to everything else.

---

## Parallel Example: User Story 1

```text
After T009 (tests written):
  Worker A: T011 → T012   SharedGameSheet.tsx
  Worker B: T010           GameRow.tsx + components.css
  Worker C: T013           NotAGameSheet.tsx
Then: T014 Shared.tsx + App.tsx (needs A and C)
```

---

## Implementation Strategy

### MVP First

1. Phases 1–2: the share arrives in the app.
2. Phase 3 (US1): sharing a game works end to end → deploy and try it on the phone (quickstart 1–4, 6, 9).
3. Then US2 (offline at the fair), US3 (lists), Polish (Config hint, real share texts, docs).

### Incremental Delivery

Each phase ends green and deployable. Small enough for one agent; an Orca Swarm ([docs/orca-swarm.md](../../docs/orca-swarm.md)) only pays off for the US1 split above.

---

## Notes

- Commit per task or logical group: `F002 T0xx: <emoji> <past-tense verb> …` (docs/commit-conventions.md).
- No `worker/` or `migrations/` changes; if one seems needed, stop and revisit the plan.
