# HTTP API contract (`/api/*`, served by the Worker)

All routes sit behind Cloudflare Access. The Worker rejects any request without a valid
`Cf-Access-Jwt-Assertion` with `401 {"error":"unauthenticated"}`. All bodies are JSON
(`application/json; charset=utf-8`). Errors use:

```json
{ "error": "<code>", "message": "<human-readable>", "retryable": true }
```

| Code | HTTP | Meaning |
|---|---|---|
| `unauthenticated` | 401 | missing/invalid Access JWT |
| `bad_request` | 400 | invalid parameters or body |
| `not_found` | 404 | e.g. geeklist does not exist |
| `bgg_unavailable` | 502 | BGG failed or timed out (`retryable: true`) |
| `bgg_rate_limited` | 503 | BGG answered 429 (`retryable: true`, `Retry-After` header) |

## Identity

### `GET /api/me`

`200 {"email": "anna@example.com", "bggSearch": false}`

`bggSearch` is `true` in Release 1.0 (official XML API token set). While `false`,
`/api/bgg/search` answers `503 {"error":"bgg_search_unavailable","retryable":false}` and the search
screen searches loaded geeklists only (plan: Delivery Order).

## BoardGameGeek proxy (cached, read-only)

### `GET /api/bgg/search?q=<text>`

- `q`: 2–100 characters, trimmed; otherwise `400`.
- `200`:
  ```json
  { "games": [ { "bggId": 295947, "name": "Cascadia", "year": 2021,
                 "thumbnailUrl": "https://cf.geekdo-images.com/…", "kind": "boardgame" } ] }
  ```
- At most 50 results; thumbnails filled from `thing` where available, otherwise `null`.

### `GET /api/bgg/geeklist/<id>?page=<n>`

- `id`: positive integer (the app extracts it from a pasted geeklist URL); `page` ≥ 1, default 1.
- `200`:
  ```json
  { "id": 123456, "title": "Spiel 26 Preview", "page": 1, "pageCount": 87, "totalItems": 2163,
    "entries": [ { "bggId": 295947, "name": "Cascadia", "kind": "boardgame",
                   "thumbnailUrl": null } ] }
  ```
- Up to 25 entries per page in geeklist order; non-game entries omitted (so a page can have fewer);
  `404` when the geeklist does not exist. Each page is cached for 1 h.
- The client loads page 1, then the remaining pages sequentially in the background.

### `GET /api/bgg/things?ids=<id,id,…>`

- 1–100 IDs; used to load thumbnails/years for geeklist entries lazily.
- `200 { "games": [Game, …] }` (shape as in search).

## Collection (per signed-in user)

### `GET /api/collection?since=<iso>`

- Without `since`: all entries incl. tombstones. With `since`: only entries with
  `updatedAt > since`.
- `200`:
  ```json
  { "entries": [ { "bggId": 295947, "state": "must_have", "name": "Cascadia", "year": 2021,
                   "thumbnailUrl": "…", "updatedAt": "2026-10-16T09:12:03.120Z",
                   "deleted": false } ],
    "serverTime": "2026-10-16T09:12:05.000Z" }
  ```

### `POST /api/collection/changes`

- Body: `{ "changes": [Change, …] }`, 1–500 items (import of a backup uses the same route).
- `Change`: `{ bggId, state | null, name, year, thumbnailUrl, detailsPending, updatedAt }`;
  `state: null` = remove. Completing BGG details (FR-019) is a change with the same state, the
  filled fields and `detailsPending: false`.
- Validation: known state keys, `bggId > 0`, `updatedAt` not more than 5 minutes in the future.
- Applies last-write-wins per `bggId` (see data-model.md).
- `200 { "applied": 3, "ignored": 1 }` — `ignored` = older than the stored version. Idempotent:
  re-sending the same change is safe.
