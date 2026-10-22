# Implementation Plan: Essen Feedback (Categories, Row Actions, Quick Filters, List Resync)

**Branch**: `005-essen-feedback` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-essen-feedback/spec.md`, design rules
[docs/design.md](../../docs/design.md) v2.2.0, feature design [design.md](design.md), accepted ADRs
0001–0006 in [docs/adr/](../../docs/adr/README.md). Builds on features 001 (collections, marks,
filter, booths, facts), 003 (action bar, sheets) and 004 (Show-off).

## Summary

Feedback from day one of SPIEL Essen 2026, mostly UI on existing data. The collection's game row
shows its category as a 1px gradient border and gets **Buy** and **Category** actions with their own
sheets; a quick filter row (Cat | Booth, 🛒 Buy) and a search sit between the two separators; the
active-filter line goes, Clear filters arrives; every group folds (For later, Poop, Not interested
start folded); booths given as a hall number count for that hall and Not interested follows the
filter. A new category **For later** is one more entry in `MARKS`. Game details get a honeycomb
category picker above the info box, BGG **rating and geek rating** (one more cached BGG JSON read per
game, R1), and **Copy / Move to collection**. The BG-Tinder card shows the details' content. A BGG
list gets **Resync** with a pure facts reconcile and a conflicts sheet. One small migration (two
nullable columns on `game`); no change to entries in the database.

Delivery order follows the fair: US1 + US2 first (rows, quick filters, search, halls), deployable
on their own; then US3, US4, US6; US5 last.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as before (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, vite-plugin-pwa, idb, postgres; no new dependency

**Storage**: Neon PostgreSQL (migration `0005_ratings.sql`: `game.rating`, `game.geek_rating`);
IndexedDB meta `activeFilter` (gains `buy`), new `declinedFacts`; entries unchanged

**Testing**: Vitest unit (marks, filter, booths, facts reconcile, membership copy/move, search,
game-info), Vitest worker (games with ratings from fixtures, sync with `later`), Playwright
(`phone`, `phone-reduced-motion`, `offline`) with axe

**Target Platform**: mobile browsers (Chrome Android, Safari iOS), installed PWA

**Project Type**: web application, one Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: row actions and category change feel instant (local first, < 100 ms to
update the row); search filters 200 games per keystroke without lag; resync of the SPIEL preview
(~140 pages) runs at the existing 1 page/s and can be left

**Constraints**: constitution V (ratings and resync only through the adapter, cached, 1 request/s,
on user demand); design rules v2.2.0; everything except resync works offline; ships during the fair
(each user story deployable alone)

**Scale/Scope**: 1 migration, 1 adapter read, ~6 domain functions, ~8 UI components touched or new
(GameRow, BuySheet, CategorySheet, CategoryPicker, QuickFilters, ConflictsSheet, CopyMoveSheet,
SwipeCard), 4 screens touched (Collection, List, Swipe, GameSheet)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0.

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | Row actions ≥ 44×52px with names ("Buy <game>", "Category of <game>"); category never by colour alone (row name includes it; sheets show emoji + label); fold buttons with `aria-expanded`; sheets keep Esc/scrim/pull-down; reduced motion respected (spin, sheets). | ✅ |
| II. Test-First | Unit tests first for `later` order, `isDefaultView`/Buy quick filter, hall-only booths, `reconcileFacts`, `copyEntry`/`moveEntry`, `matchesName`, rating parsing (fixture); worker test for `/api/bgg/games` ratings; Playwright per story before UI. | ✅ |
| III. Domain Logic Separate | Filter, booths, reconcile, copy/move, search and info order are pure functions in `src/domain/`; UI renders and calls actions. | ✅ |
| IV. Simplicity (YAGNI) | No rename of `mark` in code/DB; declined conflicts on the device only; row sheets as local state; resync reuses the list loader; no new dependency. | ✅ |
| V. Respectful BGG Integration | Ratings from `dynamicinfo` under the existing time-limited exception, behind `GeekdoSource`, cached 7 days with the game, throttled, honest User-Agent; resync only on tap, through the existing page loader; stale games refetched on demand only. | ✅ |

**Post-design re-check** (after Phase 1): unchanged, all ✅. No new ADR: the ratings read extends
ADR 0005's adapter (research R1).

## Project Structure

### Documentation (this feature)

```text
specs/005-essen-feedback/
├── spec.md, design.md, design/prototype.html
├── plan.md              # this file
├── research.md          # Phase 0 (R1–R12)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/ui.md      # API delta + UI contract for tests
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
migrations/0005_ratings.sql                 # NEW game.rating, game.geek_rating; stale where both null
worker/
├── bgg/geekdo-games.ts                     # + dynamicinfo read → rating, geekRating
├── bgg/source.ts                           # Game type: rating, geekRating
└── db/repository.ts                        # store/read the two columns
src/domain/
├── marks.ts                                # + later (For later, ⏳) after unsure
├── filter.ts                               # buy quick filter, isDefaultView, labels "Categories"
├── booths.ts                               # hall-only booths; no implicit skip exclusion
├── facts.ts                                # reconcileFacts, applyConflictChoices
├── membership.ts                           # copyEntry, moveEntry
├── game-info.ts                            # rating, geekRating infos; rowInfos skips them
└── search.ts                               # NEW matchesName (accents, case)
src/client/
├── store.ts                                # meta declinedFacts; StoredFilter.buy
└── lists.ts                                # resync(kind, id) → reload + reconcile result
src/app/
├── actions.ts                              # setCategory, unbuy, copyTo, moveTo
├── components/
│   ├── GameRow.tsx                         # div.row + open button + Buy/Category actions, tone border
│   ├── BuySheet.tsx                        # NEW (PaidForm moved out of GameSheet)
│   ├── CategorySheet.tsx                   # NEW list of categories
│   ├── CategoryPicker.tsx                  # NEW honeycomb 3 + 2
│   ├── QuickFilters.tsx                    # NEW Cat|Booth toggle, Buy chip, count, search
│   ├── GroupHeading.tsx                    # always foldable
│   ├── FilterPanel.tsx                     # Categories wording, Group by Categories/Booths, Clear filters
│   ├── GameSheet.tsx                       # picker above info box, Copy/Move buttons, BuySheet
│   ├── CopyMoveSheet.tsx                   # NEW
│   ├── ConflictsSheet.tsx                  # NEW
│   ├── SwipeCard.tsx                       # details' content: publisher·year, facts-box, full description
│   └── icons.tsx                           # IconBag, IconBagCheck, IconCategory, IconResync
├── screens/Collection.tsx                  # quick filters + search, no summary line, folding, row sheets
├── screens/List.tsx                        # Resync button, progress text, conflicts sheet
└── theme/components.css, fair.css, swipe.css   # tone border, row actions, quick filters, picker, later tone
tests/
├── fixtures/bgg/dynamicinfo-295947.json    # recorded 2026-10-23
├── unit/marks, filter, booths, facts-reconcile, membership, search, game-info tests
├── worker/bgg-games ratings test, sync with later
└── e2e/row-actions, quick-filters, categories, copy-move, resync specs (+ existing ones adjusted)
```

**Structure Decision**: the existing single-project layout; domain-first changes, one migration on
the shared game cache, no change to the entry schema.

## Complexity Tracking

No constitution violations; nothing to justify.
