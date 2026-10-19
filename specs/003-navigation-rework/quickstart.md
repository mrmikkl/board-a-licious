# Quickstart: Navigation Rework with a Context-Aware Main Button

## Local development

As feature 001 ([quickstart](../001-bgg-game-collection/quickstart.md)): `npm run db:local`,
`npm run dev`, open http://localhost:5173 at phone size (360×740) in the browser's device mode.

Icons (only when the source icons change): `node scripts/make-icons.mjs`, commit `public/icons/`.

## Tests

```bash
npx vitest run tests/unit/collection-view.test.ts tests/unit/router.test.ts tests/unit/manifest.test.ts
npx playwright test tests/e2e/navigation.spec.ts tests/e2e/collection-actions.spec.ts
npm test && npm run test:e2e        # everything still green (SC-005, SC-006)
```

## Deploy

`npm run deploy` (no migration). Installed apps pick up the new icon when Chrome refreshes the
installed app (on launch, at most about once a day); reinstalling makes it immediate.

## Validation scenarios (phone)

| # | Scenario | Expected |
|---|---|---|
| 1 | Any screen | App bar with logo, "Board-a-licious", ☰; no tab bar (US1, FR-001, FR-004) |
| 2 | ☰ → BGG lists, ☰ → Search, ☰ → Config, ☰ → Collections | each in 2 taps, current place marked, menu closes (SC-001, FR-003) |
| 3 | Collections → ＋ → name "Test" → Create collection | "Test" opens (US2, FR-007) |
| 4 | In "Test": ♥ → "❤️ BG-Tinder ❤️" → pick a loaded list → swipe one game right | the game is in "Test" (FR-008, SC-002) |
| 5 | BGG lists → ＋ → paste `boardgamegeek.com/geekpreview/93` → Load list | the list opens and loads (FR-009) |
| 6 | Search | 🔍 greyed out, nothing happens on tap (FR-010) |
| 7 | Config | no action bar, content to the bottom (FR-011) |
| 8 | Collection with games | bottom: Add game · ♥ · Filter; top: name + ✏️ only, no back button (US3) |
| 9 | ✏️ → rename → Save name; ✏️ → Delete collection… | renamed; deleted after confirmation (FR-015a) |
| 10 | Rename to a long name (~60 characters) | name scrolls left, pauses, loops; with reduced motion it ends in "…" (FR-015b) |
| 11 | Collection with marks of every kind | Must Have … Poop, line, Not yet marked (open), Not interested (closed); both fold (US4) |
| 12 | Open `#/add/list` | BGG lists with the load sheet (FR-013) |
| 13 | Install the app | home-screen icon is the meeple hexagon, no white plate (FR-019a) |
| 14 | Share a BGG game from the BGG app (002) | the shared-game sheet over the collection, still working (SC-005) |
