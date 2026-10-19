# Implementation Plan: Navigation Rework with a Context-Aware Main Button

**Branch**: `003-navigation-rework` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-navigation-rework/spec.md`, design rules
[docs/design.md](../../docs/design.md) v2.0.0, feature design [design.md](design.md), accepted ADRs
0001–0006 in [docs/adr/](../../docs/adr/README.md). Changes the app shell of features
[001](../001-bgg-game-collection/plan.md) and [002](../002-share-from-bgg/plan.md).

## Summary

A UI-only rework of the app shell. The tab bar and the "+" add screen go away. Every screen gets
the **App bar** (logo, "Board-a-licious", ☰ menu with the four places) above a **screen heading**,
and screens with actions render an **Action bar** at the bottom with a **Main button** whose icon
and action depend on the screen (Collections ＋ New collection, collection ♥ BG-Tinder, BGG lists ＋
Load a BGG list, Search 🔍 disabled). In a collection, Add game and Filter move into the action bar,
⋯ becomes a pencil after the name (Edit collection), long names run as a ticker, and the groups are
reordered (marked groups, separator, Not yet marked (folds), Not interested). Sheets that were
reached through the add screen open from routes with a query (`#/collections?new`, `#/lists?load`,
`#/collections/<id>?add=game`). The new app icon set replaces the SVG icon. No server, API or
database change.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as features 001/002 (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, vite-plugin-pwa (manifest icons), idb; no new
dependency

**Storage**: unchanged (IndexedDB per person, Neon via sync); no migration, no new meta key

**Testing**: Vitest (unit: domain grouping, router), Playwright (`phone`, `phone-reduced-motion`,
`offline`), axe; test-first; the existing e2e suite is moved from the tab bar and the add screen to
the menu and the main button (13 of 22 spec files touch them)

**Target Platform**: mobile browsers (Chrome on Android, Safari on iOS), installed PWA; desktop as
enhancement (≥ 768px: action bar stays phone-sized and centred)

**Project Type**: web application, single Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: menu opens and navigation is instant (local, no network); ticker runs on the
compositor (CSS transform only)

**Constraints**: design rules v2.0.0 (App bar, Menu, Action bar, Main button, Ticker, BG-Tinder,
Edit collection, separator, reduced motion); WCAG 2.2 AA (menu by keyboard, focus return, 44px
targets, disabled main button announced); works offline; old `#/add…` links keep working

**Scale/Scope**: ~10 screens touched, 4 new components, 2 removed, 1 domain function changed; icons

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0
(`.specify/memory/constitution.md`).

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | The point of the feature: actions within thumb reach, more room for content at 360px. The menu is a disclosure button (`aria-expanded`) with a list of links, focus moves into it and back, Esc and scrim close it; action-bar buttons ≥ 52px with visible labels; the disabled Search button uses `disabled` plus an accessible name saying it is not available yet; the ticker never hides content from screen readers (full name in the heading text) and stops under reduced motion. | ✅ |
| II. Test-First | Collection grouping (order, parts) gets unit tests first; router (new query routes, old `#/add` redirects) unit tests first; each user story's Playwright test is written or rewritten before the UI change; axe on every screen. | ✅ |
| III. Domain Logic Separate | Group order and the split into "marked" and "rest" live in `src/domain/collection.ts`; which actions a screen offers is UI (rendering), not a rule. | ✅ |
| IV. Simplicity (YAGNI) | No new dependency (icons are committed PNGs, generated once by a small script with the existing Playwright Chromium); no menu framework, no animation library; screens render their own action bar (no global registry); removes the Add screen and the tab bar. | ✅ |
| V. Respectful BGG Integration | No change to BGG access. | ✅ |

**Post-design re-check** (after Phase 1): unchanged, all ✅. No ADR: the navigation pattern is a
look-and-feel rule and is recorded in design rules v2.0.0, which bind later features.

## Project Structure

### Documentation (this feature)

```text
specs/003-navigation-rework/
├── spec.md              # /speckit-specify
├── design.md            # Ext 2: screens, flows, review decisions
├── design/prototype.html
├── design/icons/        # the Board-a-licious icon set (source of public/icons)
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1 (no stored data; routes and screen actions)
├── quickstart.md        # Phase 1
├── contracts/
│   └── navigation.md    # routes, menu entries, action bar per screen
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
index.html                              # favicon → /icons/favicon.png, apple-touch-icon
vite.config.ts                          # manifest icons 192/512 (any) + 512 maskable
public/icons/                           # NEW generated PNGs (logo, app icons, favicon); icon.svg removed
scripts/make-icons.mjs                  # NEW one-off: builds public/icons from design/icons
src/
├── domain/
│   └── collection.ts                   # groupByMark → collection group order + part ('marked' | 'rest')
└── app/
    ├── App.tsx                         # Shell: AppBar + Screen; TabBar and Add removed
    ├── router.ts                       # query flags: collections?new, lists?load, collection?add=game|list; #/add… → redirects
    ├── components/
    │   ├── AppBar.tsx                  # NEW logo, name, ☰ + Menu
    │   ├── Menu.tsx                    # NEW disclosure panel with the four places
    │   ├── ActionBar.tsx               # NEW 5-column bar, MainButton + actions
    │   ├── Ticker.tsx                  # NEW heading text that runs when too long
    │   ├── Header.tsx                  # → screen heading: title, optional back, optional trailing button
    │   ├── GroupHeading.tsx            # folds for Not yet marked too
    │   ├── ListPicker.tsx              # title "❤️ BG-Tinder ❤️"
    │   ├── NewCollectionForm.tsx       # used in the New collection sheet
    │   ├── TabBar.tsx                  # REMOVED
    │   └── icons.tsx                   # heart, pencil, burger
    ├── screens/
    │   ├── Collections.tsx             # main ＋ → New collection sheet; create card removed
    │   ├── Collection.tsx              # pencil + Edit collection, action bar, groups with separator, ticker
    │   ├── Lists.tsx                   # main ＋ → Load a BGG list sheet; load card/button removed
    │   ├── Search.tsx                  # disabled 🔍 main button; add-game link removed
    │   ├── Config.tsx, Share.tsx, List.tsx, Swipe.tsx, Shared.tsx  # links to #/add… replaced
    │   └── Add.tsx                     # REMOVED (its list form moves into the Load a BGG list sheet)
    └── theme/shell.css                 # app bar, menu, action bar, ticker; tab bar styles removed
tests/
├── unit/collection-view.test.ts        # new group order and parts
├── unit/router.test.ts                 # NEW query flags and #/add redirects
├── unit/manifest.test.ts               # NEW icons in the built manifest
└── e2e/
    ├── navigation.spec.ts              # NEW US1/US2: app bar, menu, main button per screen
    ├── collection-actions.spec.ts      # NEW US3/US4: action bar, pencil, ticker, folding, separator
    └── *.spec.ts                       # existing specs moved to menu + main button
```

**Structure Decision**: the existing single-project layout (`src/domain`, `src/client`, `src/app`,
`worker/`, `tests/`); this feature touches no `worker/` or `src/client/` code.

## Complexity Tracking

No constitution violations; nothing to justify.
