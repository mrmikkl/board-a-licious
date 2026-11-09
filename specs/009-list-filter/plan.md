# Implementation Plan: List Filter

**Branch**: `009-list-filter` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-list-filter/spec.md`, design rules
[docs/design.md](../../docs/design.md) v3.3.0, feature design [design.md](design.md), accepted ADRs
0001–0009 in [docs/adr/](../../docs/adr/README.md). Builds on 005 (Filter and group), 006 (game details
from the official API), 008 (Lists place, status lists, settings sync).

## Summary

A pure **game filter** (`src/domain/game-filter.ts`: length ranges, players n with Best/Recommended,
rating and geek rating ranges, mechanisms, designers) used by a new **Filter sheet** in every BGG list
and by the shopping lists' "Filter and group" sheet. Missing details are read through the existing
`GET /api/bgg/games` in chunks with progress; game details gain the **playing time**. The three
**length limits** are a synced setting edited in Config. App-wide, **main buttons get a caption**, and
Filter becomes the main button where it is a list's only action.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as before (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, idb, postgres, fast-xml-parser; no new dependency

**Storage**: Neon via Hyperdrive: migration `0008_list_filter.sql` (`game.playing_time`, stale
`fetched_at`, `user_setting.length_limits`); IndexedDB meta `listFilters`, `activeFilter[...].game`,
`bggSetting.lengthLimits`; games store gains `playingTime`

**Testing**: Vitest unit (game-filter matching, counts, missing counts, length ranges from limits,
player poll best/recommended, stored filter round trip, shopping list `applyFilter` with `game`),
Vitest worker (`playingtime` mapping from XML fixtures, games route returns it, migration marks old
rows stale, sync of `lengthLimits` incl. validation), Playwright at 360×740 with `/api/bgg/*` faked
(list filter sheet, reading progress, offline line, slider snapping, typed players, persistence,
Filter as main button, captions, Config game length, shopping list sections), axe

**Target Platform**: mobile browsers, installed PWA; Cloudflare Workers

**Project Type**: web application, one Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: SC-001 a filter change on 100 games with details < 0.5 s (pure in-memory
filter); SC-002 first details read of 300 games ≈ 15 BGG requests at 1/s, none on repeat

**Constraints**: constitution V (official API with token, throttle, cache; no bulk background reads:
details are read only when a filter sheet needs them); WCAG 2.2 AA (sliders keyboard-operable, all
targets ≥ 44 px); design rules v3.3.0

**Scale/Scope**: 1 domain module (+ player-poll helpers), 1 migration, 2 changed routes; components
FilterSheet sections (shared), RangeSlider, PlayersPicker, ListFilterSheet, LengthSettings,
MainButton caption; screens List, StatusList, Collection (Filter and group), Config

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.4.0.

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | Prototype checked at 360 px; chips and slider rows ≥ 44 px; native range inputs per handle with labels and value text; counts in text; main button captions are extra text, names unchanged. | ✅ |
| II. Test-First | Domain tests before `game-filter.ts`; worker tests with an XML fixture holding `playingtime`; e2e per story against faked routes. | ✅ |
| III. Domain Logic Separate | Matching, counts, length ranges, poll rules are pure functions in `src/domain/`; UI renders and stores. | ✅ |
| IV. Simplicity (YAGNI) | Reuses `/api/bgg/games`, the `game` table and settings sync; no new table, route or dependency; one filter model for both sheets. | ✅ |
| V. Respectful BoardGameGeek Integration | Details only on demand (opening a filter), through the existing throttled, cached official client; stale rows refresh lazily, no backfill job. | ✅ |

**Post-design re-check**: all ✅.

## Project Structure

### Documentation (this feature)

```text
specs/009-list-filter/
├── spec.md, design.md, design/prototype.html, checklists/requirements.md
├── plan.md, research.md (R1–R7), data-model.md, quickstart.md
├── contracts/api.md, contracts/ui.md
└── tasks.md                     # /speckit-tasks
```

No new ADR: the feature follows ADR 0007 (official API for game details) and the existing sync.

### Source Code (repository root)

```text
migrations/
└── 0008_list_filter.sql         # NEW game.playing_time, old rows stale; user_setting.length_limits
worker/
├── bgg/official.ts              # playingtime → playingTime
├── db/repository.ts             # playing_time in games; length_limits in settings
└── routes/sync.ts               # lengthLimits validation
src/domain/
├── game-filter.ts               # NEW GameFilter, matchesGame, valueCounts, missingCounts, length ranges, stored form
├── player-poll.ts               # + pollKind(poll, n): 'best' | 'rec' | null
├── filter.ts                    # Filter.game?: GameFilter; applyFilter uses matchesGame
└── game-info.ts                 # GameDetails.playingTime
src/client/
├── types.ts, store.ts           # playingTime; meta listFilters; bggSetting.lengthLimits
└── sync.ts                      # lengthLimits in settings
src/app/
├── components/ActionBar.tsx     # MainButton caption (+ active dot)
├── components/GameFilterSections.tsx   # NEW Length, Players, Rating, Geek rating, Mechanisms, Designers
├── components/RangeSlider.tsx   # NEW two-handle slider with whole-number snapping
├── components/ListFilterSheet.tsx      # NEW "Filter" for BGG lists, reading progress
├── components/FilterPanel.tsx   # "About the game" + the sections; Clear filters at the top
├── hooks/useGameDetails.ts      # NEW reads missing details in chunks of 40, progress, retry
├── screens/List.tsx, StatusList.tsx    # Filter (main button or action), count line, stored filter
├── screens/Config.tsx           # Game length section
└── (all MainButton callers)     # captions
tests/
├── fixtures/bgg-xml/thing-*.xml (playingtime)
├── unit/game-filter.test.ts, unit/player-poll.test.ts, unit/filter.test.ts
├── worker/games-route.test.ts, worker/sync.test.ts
└── e2e/list-filter.spec.ts, e2e/main-button.spec.ts (+ updated specs using the main button)
```

**Structure Decision**: one shared sections component renders the new filter in both sheets, so the
two places cannot drift apart.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Reading details in chunks with progress | filtering needs every game's details; previews have hundreds | reading on list load: wasteful; one bulk request: no progress, Worker limits |
| Marking old `game` rows stale | they lack the playing time | backfill job: bulk BGG traffic (constitution V) |
