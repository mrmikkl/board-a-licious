# Quickstart: Share from BGG into the App

## Local development

As feature 001 ([quickstart](../001-bgg-game-collection/quickstart.md)): `npm run db:local`,
`npm run dev`. A share is simulated by opening the entry URL directly, e.g.
`http://localhost:5173/share-target?text=Cascadia%20https%3A%2F%2Fboardgamegeek.com%2Fboardgame%2F295947%2Fcascadia`.

## Tests

```bash
npx vitest run tests/unit/shared.test.ts tests/unit/manifest.test.ts
npx playwright test tests/e2e/share-target.spec.ts
npm test && npm run test:e2e        # everything still green
```

## Deploy

`npm run deploy` (no migration). On the phone: open the app from its home-screen icon once so Chrome
refreshes it; if board-a-licious does not appear in the share menu within a day, remove it from the
home screen and add it again.

## Validation scenarios (phone, deployed)

| # | Scenario | Expected |
|---|---|---|
| 1 | BGG app: game page → Share → board-a-licious | Sheet over the last used collection, name and cover, "(last used)" preselected; Add to collection → game in it under Not yet marked, highlighted, toast (US1, SC-001: ≤ 2 taps, < 10 s) |
| 2 | Chrome on boardgamegeek.com: expansion page → Share → board-a-licious | Same as 1 for the expansion (FR-002) |
| 3 | Share a game that is already in the last used collection | "(already in it)", red hint, button disabled; pick another collection → adds there and that one is preselected next time (FR-004, FR-006) |
| 4 | Fresh account without collections: share a game | "SPIEL 2026" prefilled, Create and add → new collection with the game (FR-007) |
| 5 | Airplane mode: share a game, add it; reconnect | Added at once with "Details follow from BoardGameGeek"; on the second device within a minute of reconnecting (FR-009, SC-003) |
| 6 | Share a BGG blog post | "Not a BoardGameGeek game", Close / Add game by link (FR-008) |
| 7 | Share `boardgamegeek.com/geekpreview/93/…` | The list opens and loads (FR-010) |
| 8 | Open the site in a normal Chrome tab → Config | Share hint card at the top; opened from the home-screen icon: no card (FR-011) |
| 9 | Share, then Cancel | Nothing added (FR-012, SC-004) |
| 10 | 10 real game links each from the BGG app and Chrome | All recognised (SC-002) |

Details: [contracts/share-target.md](contracts/share-target.md), [data-model.md](data-model.md),
design: [design.md](design.md).
