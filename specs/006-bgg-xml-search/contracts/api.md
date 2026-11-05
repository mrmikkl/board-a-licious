# Contract: API (delta to feature 001's contracts/api.md)

## `GET /api/bgg/search?q=<text>&limit=<n>`

- `q`: 2–100 characters after trimming; `limit`: 1–50, default 50.
- `200 { "query": "cascad", "results": [ { "bggId": 295947, "name": "Cascadia", "year": 2021,
  "kind": "boardgame" }, … ] }`, ranked (research R5). No covers: the app asks `/api/bgg/games`.
- `400 bad_request`: `q` too short or long, `limit` out of range.
- `503 bgg_search_unavailable` (`retryable: false`): no token on the server.
- `503 bgg_unavailable` (`retryable: true`): BGG unreachable, token rejected, unexpected answer.
- `429 bgg_rate_limited` with `Retry-After`: BGG asked to wait (incl. a queued 202 that stayed 202).
- Cached 1 day per normalised query (and limit).

## `GET /api/me`

Unchanged: `{ "email", "bggSearch": true | false }`; `bggSearch` is `Boolean(env.BGG_TOKEN)`. The
token itself is never returned.

## `GET /api/bgg/games?ids=…`, `GET /api/bgg/lists/geeklist/<id>?page=<n>`

Same responses as before. With the token: games come from `xmlapi2/thing` (up to 40 fetched per
request instead of 10); geeklist entries have `thumbnailUrl: null` (covers via games).
`/api/bgg/lists/preview/…`, `/api/bgg/companies`, `/api/bgg/images` unchanged (website data).

## Upstream (server only)

All with `Authorization: Bearer <token>` and the app's `User-Agent`, through the 1 request/s client:

| Use | URL | TTL |
|---|---|---|
| games | `https://boardgamegeek.com/xmlapi2/thing?id=<≤20 ids>&stats=1` | 7 days |
| search | `https://boardgamegeek.com/xmlapi2/search?query=<q>&type=boardgame,boardgameexpansion` | 1 day |
| geeklist | `https://boardgamegeek.com/xmlapi/geeklist/<id>` (202 → retry ×3, 2 s) | 1 hour |
