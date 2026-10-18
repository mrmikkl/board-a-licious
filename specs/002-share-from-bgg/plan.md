# Implementation Plan: Share from BGG into the App

**Branch**: `002-share-from-bgg` | **Date**: 2026-10-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-share-from-bgg/spec.md`, design rules
[docs/design.md](../../docs/design.md) v1.9.0, feature design [design.md](design.md), accepted ADRs
0001–0006 in [docs/adr/](../../docs/adr/README.md). Builds on feature
[001](../001-bgg-game-collection/plan.md) and its code.

## Summary

The installed app (PWA) registers as an Android share target through its web app manifest. Sharing
a BoardGameGeek page from the BGG app or Chrome opens the app at `/share-target` with the shared
title, text and link; the app turns that into an in-app route and shows the **Shared game** sheet
over the collection shared into last. Adding reuses feature 001's add-by-link path (local first,
outbox, sync, details completed later), so offline and expired sign-ins need nothing new. Reading the
shared text (finding the game or list link, a good name) is a small pure domain function. No server,
database or API changes.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as feature 001 (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, vite-plugin-pwa (manifest `share_target`), idb; no new
dependency

**Storage**: unchanged: IndexedDB per person (new meta key `lastShareCollection`), Neon via the
existing sync; no migration

**Testing**: Vitest (unit, domain), Playwright (`phone`, `phone-reduced-motion`, `offline` projects),
axe; test-first as in 001

**Target Platform**: Android with Chrome, app installed to the home screen (Web Share Target);
other browsers keep working without the share entry (iOS Safari has no web share target)

**Project Type**: web application, single Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: from tapping board-a-licious in the share menu to the sheet < 2 s on a warm
start; adding is instant (local first) (SC-001)

**Constraints**: works offline and with an expired Access session (FR-009); a share never adds a
game twice (SC-004); follows design rules v1.9.0 (Shared game, Choosing a collection, Share hint,
sheet motion)

**Scale/Scope**: one sheet, one route, one manifest entry, one Config card; ~10 small files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0
(`.specify/memory/constitution.md`).

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | The flow is phone-only by nature; the sheet follows the existing Sheet (focus, Esc, scrim, 44 px targets); the dropdown is a native `select` with a label; hints are plain text, errors in the red hint style with text, not colour alone. | ✅ |
| II. Test-First | Reading shared text is a pure domain function with unit tests written first (real share texts as fixtures); routing, sheet, offline and the Config hint get Playwright tests first; manifest checked in a build test. | ✅ |
| III. Domain Logic Separate | `src/domain/shared.ts` decides game, list or nothing and the suggested name; the UI only renders and calls the existing `addGameByLink` / `createCollection` actions. | ✅ |
| IV. Simplicity (YAGNI) | No new dependency, no server change, no new data on the server; GET share target (no service-worker POST handling); reuses add-by-link, sheet, toast and list loading. | ✅ |
| V. Respectful BGG Integration | No new BGG requests: the game comes from the link; name, cover and details follow through 001's cached, throttled details completion. | ✅ |

**Post-design re-check** (after Phase 1): unchanged, all ✅. No ADR needed: registering as a share
target is local to this feature and binds no later feature.

## Project Structure

### Documentation (this feature)

```text
specs/002-share-from-bgg/
├── spec.md              # /speckit-specify
├── design.md            # Ext 2: screens and decisions
├── design/prototype.html
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── share-target.md  # manifest entry, URL, in-app route
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
vite.config.ts                         # manifest: share_target (GET /share-target)
src/
├── domain/
│   └── shared.ts                      # NEW readShare(): game | list | none, suggested name
├── client/
│   └── store.ts                       # meta key lastShareCollection
└── app/
    ├── share-target.ts                # NEW: /share-target?… → #/shared?…, once, on boot
    ├── router.ts                      # route { name: 'shared', title, text, url }
    ├── App.tsx                        # renders the Shared screen
    ├── screens/
    │   ├── Shared.tsx                 # NEW: last share collection behind, sheet on top
    │   └── Config.tsx                 # Share hint card when not standalone
    ├── components/
    │   ├── SharedGameSheet.tsx        # NEW: Shared game sheet (dropdown, hints, offline note)
    │   └── GameRow.tsx                # "just added" highlight
    └── theme/components.css           # shared-sheet layout, just-added highlight
tests/
├── unit/shared.test.ts                # NEW readShare with real share texts
├── unit/manifest.test.ts              # NEW share_target in the built manifest
└── e2e/share-target.spec.ts           # NEW the flows of quickstart.md
```

**Structure Decision**: the existing single-project layout of feature 001 (`src/domain`,
`src/client`, `src/app`, `worker/`, `tests/`); this feature touches no `worker/` code.

## Complexity Tracking

No constitution violations; nothing to justify.
