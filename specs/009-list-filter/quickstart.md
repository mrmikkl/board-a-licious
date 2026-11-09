# Quickstart: validating the list filter

## Automated

```bash
npx vitest run tests/unit/game-filter.test.ts tests/unit/player-poll.test.ts tests/worker/games-route.test.ts tests/worker/sync.test.ts
npx playwright test tests/e2e/list-filter.spec.ts tests/e2e/main-button.spec.ts
npm test && npm run build && npm run test:e2e
```

## On the phone (after `npm run db:migrate:neon` and deploy)

1. Lists › Previews › SPIEL preview: the main button is Filter. Open it: "Reading game details… n of N"
   runs, the sections fill.
2. Length Middle, Players 3 (Best + Recommended), Mechanisms "Cooperative Game": the count line shows
   "n of N games"; Done · n games.
3. Rating slider: drag the left handle near 7, it rests on 7.0.
4. Type 10 into the players field: games best or recommended with 10 remain (likely none).
5. Leave and reopen the list: the filter is still set; Clear filters (top) resets it.
6. Owned status list: Filter at the left, Add game as main button.
7. A shopping list › Filter and group › About the game: the same sections work with Categories.
8. Config › Game length: Short ends at 45; a 40-minute game now counts as Short; on a second device the
   limits are the same.
9. Every main button shows its caption (Tinder, New list, Load list, Add game, Filter).
