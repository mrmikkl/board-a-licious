# Quickstart: validating Official BGG Data and Search

## Without a token (SC-006)

```bash
npm run db:local        # keep running
npm run dev             # .dev.vars without BGG_TOKEN
npm test && npm run test:e2e
```

Expected: all tests green; Search shows "Searching all of BoardGameGeek comes soon" without an
action bar; Add game accepts links, and a typed name says to paste a link instead.

## Automated checks with fakes

- `npx vitest run tests/worker/bgg-official.test.ts tests/worker/bgg-routing.test.ts tests/worker/search-route.test.ts`:
  XML mapping, Bearer header, 202 retry, 401 log without the token, source per kind, search route.
- `npx vitest run tests/unit/bgg-search.test.ts`: ranking, query rules, name vs link.
- `npx playwright test tests/e2e/search.spec.ts tests/e2e/add-game-name.spec.ts`: the flows of
  [contracts/ui.md](contracts/ui.md) with `/api/me`, `/api/bgg/search` and `/api/bgg/games` faked.

## Against BoardGameGeek, locally (owner only)

The owner adds `BGG_TOKEN=…` to `.dev.vars` themselves (git-ignored; never pasted into chat), then
`npm run dev`:

1. Search "cascad": Cascadia first, its expansions marked, covers follow (US1, SC-002).
2. "+" on Cascadia → tick Essen 2026, Must Have, Done: toast, row says "in Essen 2026".
3. Open a game not loaded before: details and ratings as before (US2-1); the Worker log shows only
   `boardgamegeek.com/xmlapi2/thing` requests for it.
4. Load a geeklist: games and positions as before; covers fill in (US2-2).
5. SPIEL preview and a game's images: load as before (US2-3).
6. Type a 10-letter name quickly: at most 2 `xmlapi2/search` requests in the log (SC-005).
7. Set a wrong token: Search shows "BoardGameGeek is not reachable", the log says "bgg token
   rejected 401" without the token (US2-5).

## Production

`npx wrangler secret put BGG_TOKEN` (the owner types the token at the prompt), then `npm run deploy`.
Over a day, the Worker logs show no `api.geekdo.com/api/geekitems?…objecttype=thing`,
`dynamicinfo`, `geeklists` or `listitems` requests (SC-003).
