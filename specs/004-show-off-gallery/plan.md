# Implementation Plan: Big Game Images, BGG Gallery and Show-off

**Branch**: `004-show-off-gallery` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-show-off-gallery/spec.md`, design rules
[docs/design.md](../../docs/design.md) v2.1.0, feature design [design.md](design.md), accepted ADRs
0001–0006 in [docs/adr/](../../docs/adr/README.md). Builds on features 001 (game details, BGG
adapter) and 003 (action bar, route-driven sheets).

## Summary

Two UI additions and one BGG read. (1) An **image viewer**: tapping a cover in a game's details
sheet opens the image full screen; the game's BoardGameGeek gallery (main image first, up to 50,
from a new `GET /api/bgg/images?id=` route backed by BGG's public gallery JSON through the existing
cached adapter) is swiped through with a gesture module that springs back at the ends and never
re-renders the viewer. (2) **Show-off**: a fourth action in a collection's action bar opens a sheet
to choose groups (remembered per collection on the device) and then a screen with the covers as a
honeycomb (three per row, shifted rows); hexagons open the same viewer. No database change.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as before (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, vite-plugin-pwa, idb; no new dependency

**Storage**: unchanged schema; IndexedDB meta key `showOff`; server-side BGG cache for galleries

**Testing**: Vitest (unit: `orderGallery`, `showOffGames`, viewer gestures, router; worker:
`/api/bgg/images` with the recorded fixture), Playwright (`phone`, `phone-reduced-motion`,
`offline`) with the API faked from fixtures; axe

**Target Platform**: mobile browsers (Chrome Android, Safari iOS), installed PWA; desktop enhancement

**Project Type**: web application, single Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: cover big instantly, sharp image < 2 s (SC-001); next image < 1 s when
preloaded (SC-002); Show-off of 100 games scrolls smoothly (SC-004)

**Constraints**: constitution V (gallery only on demand, through the server, cached 7 days, one BGG
request per second); design rules v2.1.0 (Image viewer, Show-off, motion, reduced motion); works
offline with what is on the phone

**Scale/Scope**: 1 API route, 1 adapter method, 2 domain functions, 1 gesture module, 3 UI
components (viewer, Show-off sheet, honeycomb screen), 2 routes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0.

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | Phone-first viewer and honeycomb; viewer is a modal dialog with Close, arrow keys, Esc and Back, images with alt text and a live position; hexagons are buttons named "<game>, <mark>"; 44px controls; reduced motion switches slides and fades off. | ✅ |
| II. Test-First | Unit tests first for `orderGallery`, `showOffGames`, gestures and routes; worker test for `/api/bgg/images` against the recorded fixture (no live BGG); Playwright tests per story before the UI. | ✅ |
| III. Domain Logic Separate | Gallery order and Show-off order are pure functions in `src/domain/`; gesture decisions in a framework-free module; UI renders. | ✅ |
| IV. Simplicity (YAGNI) | No new dependency; no image proxy; no IndexedDB store for galleries (server cache + session memory); CSS honeycomb; viewer state not a route (history entry only). | ✅ |
| V. Respectful BGG Integration | Gallery read only when the viewer opens, server-side via the existing adapter (honest User-Agent, rate limit, 7-day cache); public JSON under the time-limited exception (the XML API offers no gallery); failures leave the cover and a clear line. | ✅ |

**Post-design re-check** (after Phase 1): unchanged, all ✅. No ADR: one more method on the BGG
adapter of ADR 0005, recorded in research R1.

## Project Structure

### Documentation (this feature)

```text
specs/004-show-off-gallery/
├── spec.md, design.md, design/prototype.html
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── images-api.md    # GET /api/bgg/images, viewer and Show-off UI contract
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
worker/
├── bgg/source.ts                     # BggSource.getGallery(bggId)
├── bgg/geekdo-images.ts              # NEW gallery JSON → GameImage[] (+ main imageid from geekitems)
└── index.ts                          # GET /api/bgg/images
src/
├── domain/
│   ├── gallery.ts                    # NEW GameImage, orderGallery (main first, dedupe, cap 50)
│   └── collection.ts                 # showOffGames(entries, groups, nameOf)
├── client/
│   ├── api.ts                        # getGallery(bggId) + session cache
│   └── store.ts                      # meta showOff
└── app/
    ├── router.ts                     # collection open 'showoff'; route 'showoff' with groups
    ├── viewer-gesture.ts             # NEW pure swipe/close decisions (R5)
    ├── components/
    │   ├── ImageViewer.tsx           # NEW full-screen viewer (track, dots, caption, ✕, keys, history)
    │   ├── GameSheet.tsx             # cover → viewer button with ⤢ badge
    │   ├── ListGameSheet (List.tsx)  # same for a BGG list's game sheet
    │   ├── ShowOffSheet.tsx          # NEW group choice (multi-choice, remembered)
    │   └── icons.tsx                 # IconShowOff (three hexagons)
    ├── screens/
    │   ├── Collection.tsx            # Show-off action (outer right), ?show-off sheet
    │   └── ShowOff.tsx               # NEW honeycomb screen
    └── theme/viewer.css, showoff.css # NEW styles; actionbar.css: outer-right slot
tests/
├── fixtures/bgg/images-295947.json   # recorded (8 images, total 600)
├── unit/gallery.test.ts, viewer-gesture.test.ts   # NEW
├── unit/collection-view.test.ts, router.test.ts   # showOffGames, show-off routes
├── worker/bgg-images.test.ts         # NEW route + adapter with the fixture
└── e2e/viewer.spec.ts, show-off.spec.ts           # NEW
```

**Structure Decision**: the existing single-project layout; this feature adds one Worker route and
touches no database code.

## Complexity Tracking

No constitution violations; nothing to justify.
