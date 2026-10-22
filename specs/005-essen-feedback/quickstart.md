# Quickstart: Essen Feedback

## Local development

As before: `npm run db:local` (keep running), `npm run dev`, http://localhost:5173 at 360×740. The
migration `0005_ratings.sql` runs on start. Fixtures: `tests/fixtures/bgg/dynamicinfo-295947.json`
(ratings), `geekitems-295947.json`, `preview-93*.json`.

## Tests

```bash
npx vitest run tests/unit           # marks, filter (buy, default), booths, facts reconcile, membership copy/move, search, game-info
npx vitest run --project worker     # games with ratings, sync with "later"
npx playwright test tests/e2e/row-actions.spec.ts tests/e2e/quick-filters.spec.ts tests/e2e/categories.spec.ts tests/e2e/resync.spec.ts tests/e2e/copy-move.spec.ts
npm test && npm run test:e2e
```

## Deploy

`npm run deploy` (the migration runs with it, as before via `npm run db:migrate:neon`).

## Validation scenarios (phone, deployed)

| # | Scenario | Expected |
|---|---|---|
| 1 | Collection → Buy on a game → 25 → Got it | row bought, Buy shows €25, celebration (US1, SC-001) |
| 2 | Buy on that game again | not bought, toast (US1 #3) |
| 3 | Category on an Interested game → Must Have | border orange, game in Must Have, toast (SC-002) |
| 4 | Tap Booth | halls; a game with booth "3" in Hall 3 after the full booths (SC-005) |
| 5 | Tap 🛒 Buy | only not-bought Must Have/Interested/Unsure; Filter highlighted; tap again: as before (SC-003) |
| 6 | Type "cas" | only matching names (SC-004) |
| 7 | Filter → select Not interested only, group by booth | Not interested games in their halls |
| 8 | Filter → Clear filters | everything, by categories, Filter not highlighted |
| 9 | Open a collection | For later, Poop, Not interested folded; tap any heading folds/unfolds |
| 10 | Details of a game | honeycomb picker above the info box, Rating and Geek rating shown; For later works |
| 11 | Details → Move to collection → another → Move | game gone here, in the other with category, bought, price |
| 12 | BG-Tinder | card shows publisher · year, info box with ratings, full description |
| 13 | SPIEL preview list → Resync | progress, toast; with a hand-typed booth differing: conflicts sheet; Use BGG for all (SC-006) |
| 14 | Airplane mode → Buy, Category, Move | work, synced later; Resync disabled |
