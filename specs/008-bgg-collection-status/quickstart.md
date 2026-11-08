# Quickstart: validating BGG statuses, Buy and Lists

## Automated

```bash
npx vitest run tests/unit/bgg-status.test.ts tests/unit/router.test.ts tests/worker/bgg-collection.test.ts tests/worker/bgg-account.test.ts
npx playwright test tests/e2e/places.spec.ts tests/e2e/status-lists.spec.ts tests/e2e/bgg-status.spec.ts tests/e2e/buy-owned.spec.ts
npm test && npm run build
```

Worker tests use recorded answers in `tests/fixtures/bgg-xml/collection-*.xml` and
`tests/fixtures/bgg-web/` (T001, cookies and names removed); e2e tests fake `/api/bgg/*`.

## Locally against BoardGameGeek (`npm run dev`)

`.dev.vars` needs `BGG_TOKEN` and `BGG_SESSION_KEY` (any 32-byte base64 value locally; in production
`npx wrangler secret put BGG_SESSION_KEY`). Use a BGG test account or a test game you can change.

1. Menu: Buy, Lists, Config. Buy opens on Search; Shopping lists shows the collections as before.
2. Config: username "mrmikkl", Save. Lists › Status lists: Owned, Wishlist … with counts (first time
   possibly "BoardGameGeek is preparing your collection…", then the lists by themselves).
3. Open Owned: games with "in …" and badges; tap one: the game sheet, BGG status folded with badges.
4. Buy › Search "cascadia": badges on results; Add opens the shopping list choice.
5. Config › Sign in to BoardGameGeek with the test account; reload: still signed in; a second
   browser profile: not signed in. Developer tools › Application › Cookies: `bal_bgg` is HttpOnly and
   unreadable text; IndexedDB and localStorage hold no BGG session.
6. Game sheet › BGG status: tick Want to play, Save on BoardGameGeek; the BGG website shows it.
7. In a shopping list: Buy a game not owned, 45 €, Got it, Mark as owned: BGG shows Owned and the
   private info (price, date, "acquired from").
8. Repeat 7 with another price: "Replace the price paid on BoardGameGeek?".
9. Sign out of BoardGameGeek: the cookie is gone; saving asks to sign in again.
10. Worker log (`wrangler tail` or the dev console) during 5–9: no password, cookie or session value.
