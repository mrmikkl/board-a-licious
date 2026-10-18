# HTTP API contract (`/api/*`, served by the Worker)

Re-planned 2026-10-17. All routes sit behind Cloudflare Access; the Worker rejects requests without a
valid `Cf-Access-Jwt-Assertion` with `401 {"error":"unauthenticated"}`. Bodies are JSON. Errors:

```json
{ "error": "<code>", "message": "<human-readable>", "retryable": true }
```

| Code | HTTP | Meaning |
|---|---|---|
| `unauthenticated` | 401 | missing/invalid Access JWT |
| `bad_request` | 400 | invalid parameters or body |
| `not_found` | 404 | list or game does not exist |
| `bgg_unavailable` | 502 | BGG failed or timed out (`retryable: true`) |
| `bgg_rate_limited` | 503 | BGG answered 429 (`retryable: true`, `Retry-After`) |
| `bgg_search_unavailable` | 503 | search before Release 1.0 (`retryable: false`) |

## Identity

### `GET /api/me`

`200 {"email": "anna@example.com", "bggSearch": false}` — `bggSearch` is `true` in Release 1.0.

## BoardGameGeek proxy (read-only, cached)

### `GET /api/bgg/lists/<kind>/<id>?page=<n>`

- `kind`: `preview` | `geeklist`; `id` > 0; `page` ≥ 1 (default 1). The app extracts kind and id
  from a pasted link (`/geekpreview/<id>…`, `/geeklist/<id>…`).
- `200`:
  ```json
  { "kind": "preview", "id": 93, "title": "SPIEL Essen 2026",
    "page": 1, "pageCount": 138,
    "entries": [ { "position": 1, "bggId": 446453, "name": "…", "thumbnailUrl": "https://…",
                   "facts": { "booth": "3-R400", "priceCents": 6000, "currency": "EUR",
                              "publisherId": 34183, "publisher": "Inside Up Games",
                              "edition": "English edition" },
                   "info": { "minPlayers": 1, "maxPlayers": 4, "designers": ["Gilles Turbide"],
                             "mechanisms": ["Chaining", "Closed Drafting"] } } ] }
  ```
- Geeklists: no `facts` and no `info`, up to 25 entries per page, non-game entries omitted.
- Previews: `facts.edition` is the item's version name; `info` comes from the item's game
  (`geekitem`) and needs no extra request.
- Previews: 10 entries per page; price = `showprice`, else `msrp`. `publisher` comes from the
  company cache and is `null` while a company is not resolved yet; the page never waits for company
  lookups (SC-002). The app resolves missing names with `GET /api/bgg/companies`.
- Each page cached 1 h at the edge; `404` for unknown lists.

### `GET /api/bgg/companies?ids=<id,id,…>`

- 1–10 company IDs. `200 { "companies": [ { "id": 34183, "name": "Inside Up Games" } ] }`.
- Each name cached 30 days; requests to BGG throttled to 1/s like all others.

### `GET /api/bgg/games?ids=<id,id,…>`

- 1–50 IDs. `200 { "games": [ { "bggId", "name", "year", "thumbnailUrl", "description", "kind",
  "minPlayers", "maxPlayers", "designers", "mechanisms", "publisher" } ] }` (`publisher`: the game's
  first BGG publisher; lists are `[]` when BGG has none).
- Served from the `game` table when fresher than 7 days, else from BGG (cached).

### `GET /api/bgg/search?q=<text>` (Release 1.0)

- `q` 2–100 chars. `200 { "games": [Game…] }` (max 50) once `bggSearch` is true; before that `503
  bgg_search_unavailable`.

## Collections (per signed-in user)

### `GET /api/sync?since=<iso>`

- Without `since`: everything; with `since`: only rows the **server received** after `since`
  (column `synced_at`, incl. tombstones), not by the device's `updatedAt`: a change made offline and
  sent later must still reach devices that synced in between.
- `serverTime` is the next `since`: the database's clock a few seconds back, so writes still on their
  way are fetched again (merging is last-write-wins and harmless when repeated).
- `200`:
  ```json
  { "collections": [ { "id": "c0f…", "name": "Essen 2026",
                       "updatedAt": "2026-10-17T09:12:03.120Z", "deleted": false } ],
    "entries": [ { "collectionId": "c0f…", "bggId": 446453, "mark": "must_have",
                   "bought": true, "paidCents": 5200, "paidCurrency": "EUR",
                   "facts": { "booth": "3-R400", "priceCents": 6000, "currency": "EUR",
                              "publisher": "Inside Up Games", "edition": "English edition" },
                   "factsSource": "preview", "detailsPending": false,
                   "updatedAt": "2026-10-17T09:14:00.000Z", "deleted": false } ],
    "serverTime": "2026-10-17T09:14:05.000Z" }
  ```

### `POST /api/sync`

- Body: `{ "collections": [Collection…], "entries": [Entry…], "lists": [LoadedList…] }` (`lists`
  optional), together 1–500 items (backup import uses the same route). `LoadedList` =
  `{ "kind": "preview", "id": 93, "title": "SPIEL Essen 2026", "updatedAt", "deleted" }`;
  `GET /api/sync` returns `lists` too.
- Validation: collection name 1–60 chars (a `type` or `isEssen` sent by an older app is ignored);
  entry mark known, `bggId > 0`,
  `paidCents`/`priceCents` ≥ 0, entry's collection belongs to the user; `updatedAt` at most 5 min in
  the future.
- Last write wins per collection and per entry. `200 { "applied": 3, "ignored": 1 }`; idempotent.
