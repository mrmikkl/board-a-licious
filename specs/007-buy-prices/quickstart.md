# Quickstart: validating Buy

## Automated

```bash
npx vitest run tests/unit/offers.test.ts tests/worker/prices-*.test.ts
npx playwright test tests/e2e/buy.spec.ts tests/e2e/prices-section.spec.ts
npm test && npm run build
```

Worker tests use recorded answers in `tests/fixtures/prices/`; e2e tests fake `/api/prices`.

## Against the real sources (locally, `npm run dev`, BGG token in `.dev.vars`)

1. Menu: Buy is first. Search "cascadia", pick Cascadia: New offers "Shop in Germany …" with EN/DE tags,
   cheapest first, no French edition; the source line links to brettspielpreise.de.
2. Tap a new offer: brettspielpreise.de forwards to the shop.
3. Used: BGG marketplace listings in EUR/GBP/…, GBP with "≈ €"; no USD listings.
4. Links "Search on Kleinanzeigen" and "Search on eBay.de" open those searches.
5. Open Cascadia's details in a collection: Prices folded; tap: offers load; the fair price shows on top.
6. Choose German: only German editions; reopen another game: German still chosen.
7. Twice within an hour: the second answer comes from the cache (no new brettspielpreise.de request in
   the Worker log).

## eBay (once the owner has approved keys)

`npx wrangler secret put EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` (and the same lines in `.dev.vars`);
then used eBay offers appear instead of the eBay link.
