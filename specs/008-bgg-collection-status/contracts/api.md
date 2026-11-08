# Contract: API

All routes sit behind Cloudflare Access (ADR 0003); errors use the existing `{ error, message,
retryable }` shape. New error codes: `bgg_preparing`, `bgg_signed_out`, `bgg_refused`,
`price_conflict`.

## `GET /api/bgg/collection?user=<bggUser>[&fresh=1]`

Reads a person's BGG collection through the official API (research R1); any public collection.

- `200`:
  ```json
  { "bggUser": "mrmikkl", "loadedAt": "2026-11-08T18:00:00Z",
    "items": [ { "bggId": 295947, "name": "Cascadia", "year": 2021, "thumbnailUrl": "https://…",
                 "kind": "boardgame",
                 "status": { "own": true, "prevOwned": false, "forTrade": false, "wantInTrade": false,
                             "wantToBuy": false, "wantToPlay": false, "preordered": false, "wishlist": null } } ] }
  ```
- `202 bgg_preparing` + `Retry-After: <s>`: BGG is still preparing; the app retries (5, 10, 20 s …)
  for about a minute.
- `404 not_found`: no such BGG user (or a private collection, see research R1).
- `fresh=1` skips the 15-minute edge cache (only on Refresh).

## `GET /api/bgg/account`

`200 { "signedIn": true, "bggUser": "mrmikkl" }` or `{ "signedIn": false }`. Reads only the cookie
(no BGG request).

## `POST /api/bgg/account/signin`

Body `{ "username": "mrmikkl", "password": "…" }` (never logged).

- `200 { "signedIn": true, "bggUser": "mrmikkl" }` + `Set-Cookie: bal_bgg=<encrypted>; Path=/api/bgg/account; HttpOnly; Secure; SameSite=Strict; Max-Age=…`
- `401 bgg_signed_out` "BoardGameGeek did not accept this username or password." (no cookie)
- `502 bgg_unavailable` when BGG cannot be reached.

## `POST /api/bgg/account/signout`

`200 { "signedIn": false }` + `Set-Cookie: bal_bgg=; Max-Age=0; …`. Also called by the app before
it signs out of the app.

## `POST /api/bgg/account/collection/<bggId>`

Writes the signed-in person's own collection (research R3). The cookie decides who; the body never
names a user.

- Body:
  ```json
  { "status": { "own": true, "wishlist": null },
    "privateInfo": { "pricePaid": { "amount": 45, "currency": "EUR" }, "acquisitionDate": "2026-11-08",
                     "acquiredFrom": "SPIEL Essen 2026 · booth 3-A101" },
    "replacePrice": false }
  ```
  `status`: only the changed keys (`diff`); `privateInfo` and `replacePrice` optional. At least one
  of `status` or `privateInfo`.
- `200 { "bggId": 295947, "status": { …all keys… } }`: the item as BGG has it after the save.
- `409 price_conflict { "current": { "amount": 39.99, "currency": "EUR" } }`: BGG already holds
  another price paid and `replacePrice` was not true; nothing was written.
- `401 bgg_signed_out`: no, expired or foreign cookie, or BGG rejected the session (cookie cleared).
- `502 bgg_refused` "BoardGameGeek did not take the change.": BGG answered with an error; nothing
  changed in the app.
- `400 bad_request`: unknown keys, priority outside 1–5, price ≤ 0 or > 10000, date not
  `YYYY-MM-DD`, `acquiredFrom` > 100 chars.

## `GET/POST /api/sync` (changed)

`Changes` gains two optional arrays, same rules as `lists` (validated, last write wins, `synced_at`
cursor):

```json
{ "settings": [ { "bggUsername": "mrmikkl", "updatedAt": "…" } ],
  "follows":  [ { "bggUser": "anna_meeple", "updatedAt": "…", "deleted": false } ] }
```

Older app versions that do not send them keep working.

## Upstream (Worker only)

| Request | Auth | Cache |
|---|---|---|
| `https://boardgamegeek.com/xmlapi2/collection?username=<u>&subtype=boardgame&excludesubtype=boardgameexpansion` and `&subtype=boardgameexpansion` | app token (Bearer) | 15 min |
| `POST https://boardgamegeek.com/login/api/v1` | the credentials, once | never |
| BGG's collection item read and save (website, exact endpoints recorded in T001) | the person's session cookies | never |
