# Research: BGG Statuses, Buy and Lists

Phase 0 of [plan.md](plan.md). Accepted ADRs 0002–0004, 0006–0008 apply unchanged; new decisions that
bind later features are in [ADR 0009](../../docs/adr/0009-writing-to-a-persons-bgg-collection.md)
(Accepted). Checked on 2026-11-08; points marked **verify in T001** need one look at real traffic
before code depends on them.

## R1. Reading statuses: the official collection API

- **Decision**: `GET https://boardgamegeek.com/xmlapi2/collection?username=<name>&subtype=boardgame&excludesubtype=boardgameexpansion`
  and a second request with `subtype=boardgameexpansion` (BGG reports expansions as `boardgame`
  otherwise, per the XML API2 wiki), both through the existing official client (token, 1 request/s,
  honest User-Agent). Each `<item>` carries `objectid`, `name`, `yearpublished`, `thumbnail` and
  `<status own prevowned fortrade want wanttoplay wanttobuy wishlist wishlistpriority preordered>`.
  One answer per person holds every status, so the eight status lists are cut from it on the
  device (`src/domain/bgg-status.ts`), instead of eight filtered requests.
- **202 "queued"**: BGG answers 202 while it prepares a collection not asked for recently. The
  client already retries 3 × 2 s for geeklists; for collections the Worker answers
  `bgg_preparing` (with `Retry-After`) after its own retries, and the app retries with growing
  pauses (5, 10, 20 s …) for about a minute while showing "BoardGameGeek is preparing your
  collection…" (FR-005). Keeps a Worker request short.
- **Cache**: 15 minutes at the edge per username; the app re-reads when a status list or Lists ›
  Status lists opens and its copy is older than 1 hour (FR-004), and on Refresh. Refresh sends
  `fresh=1`, which skips the edge cache (only on a person's tap).
- **Unknown user / private collection**: BGG answers an `<errors>` document ("Invalid username
  specified") → `not_found`. **Verify in T001**: what a private collection returns.
- **Alternatives**: one request per status (`own=1`, `wishlist=1`, …): eight times the requests and
  eight 202 waits. Website JSON (`api.geekdo.com` collections): forbidden once the official API
  offers the data (constitution V, ADR 0007).

## R2. Signing in to BoardGameGeek

- **Decision**: the Worker posts the credentials once to BGG's website login,
  `POST https://boardgamegeek.com/login/api/v1` with `{"credentials":{"username","password"}}`
  (the request BGG's login form sends; a published store-sync script uses the same,
  [gist](https://gist.github.com/karptonite/408f7b5597a21af08a7a68f23f512deb)), and keeps the session cookies BGG sets (`SessionID`, `bggusername`,
  `bggpassword`). The password is not stored anywhere; the Worker forwards it once and forgets it.
- **Found in T001** (recorded 2026-11-08, `tests/fixtures/bgg-web/signin.json`): JSON body
  `{"credentials":{"username","password"}}`, answer **204** with an empty body and the session in
  `Set-Cookie: SessionID=…` (plus `bggusername`/`bggpassword` cookies on some accounts; the adapter
  keeps every cookie BGG sets and sends them back unchanged).
- **Not recorded**: the answer for wrong credentials. The adapter treats any answer other than 204,
  or a 204 without `SessionID`, as "BoardGameGeek did not accept this username and password"
  (`bgg_signin_failed`); 429/5xx stay "BoardGameGeek is busy". Checked by hand in the T053
  walkthrough. Session lifetime: unknown; the app cookie expires after 30 days at most and an
  expired BGG session shows as "sign in again" on the next save.
- **Alternatives**: OAuth (BGG offers none); the official API token (identifies the app, not a
  person; read-only); storing the password to sign in again later (rejected: FR-011).

## R3. Writing statuses and private info

- **Decision**: the website's collection save that BGG's own "Add to collection / Edit" dialog
  uses, called by the Worker with the person's session cookies: read the person's item for the
  game (its collection id `collid`, current statuses, current price paid), then save only the
  changed fields: the status group (`own`, `prevowned`, `fortrade`, `want`, `wanttoplay`,
  `wanttobuy`, `wishlist` + `wishlistpriority`, `preordered`) and, after buying, the private info
  group (price paid, currency, acquisition date, acquired from). A game not yet in the collection
  is added by the same save without a `collid`.
- **Not documented**: BGG publishes no write API. Community tools post to
  `geekcollection.php` (`ajax=1`, `action=savedata`, `objecttype=thing`, `objectid`, `collid`,
  `fieldname=status` / `ownership`, …); newer pages may use a JSON endpoint under `/api/`.
  **T001 (spike, with the owner)**: record in the browser's developer tools what BGG sends when
  the owner (a) signs in, (b) ticks Own and Wishlist 2 on a test game, (c) enters a price paid,
  date and "acquired from", (d) opens the edit dialog of an owned game; save the requests and
  answers as fixtures in `tests/fixtures/bgg-web/` with cookies and the username removed. The
  adapter `worker/bgg/account.ts` is written against those fixtures; nothing else knows the
  endpoint (FR-018, ADR 0009).
- **Found in T001** (fixtures in `tests/fixtures/bgg-web/`, the collid replaced by 123456789):
  - All saves are `POST https://boardgamegeek.com/geekcollection.php` as
    `application/x-www-form-urlencoded` with `ajax=1&action=savedata&objecttype=thing&objectid=<bggId>&collid=<collid or empty>`
    and the session cookies; answers are 200.
  - **Statuses** (`save-status.form`, `save-status-new.form`): `fieldname=status` and one field per
    **ticked** status (`own=1`, `prevowned=1`, `fortrade=1`, `want=1`, `wanttoplay=1`, `wanttobuy=1`,
    `wishlist=1`, `preordered=1`; unticked ones are left out) plus `wishlistpriority=1..5` always.
    The form is the whole status group: a save **replaces all statuses**, so the Worker sends the
    current statuses merged with the person's change, never only the changed one. An empty
    `collid` adds the game. The dialog's read (`action=editdata&fieldname=status`) came back
    empty in the recording, so the current statuses and the `collid` come from the official
    collection API for that one game (`/xmlapi2/collection?username=<u>&id=<bggId>`, fresh, with
    the app token and **without** the person's cookies; ADR 0009).
  - **Private info** (`ownership-editdata.url/.html`, `save-ownership*.form/.html`):
    `fieldname=ownership` with `pricepaid`, `pp_currency` (USD, EUR, GBP, CAD, AUD, YEN only),
    `currvalue`, `cv_currency`, `quantity`, `acquisitiondate` + `dateinput` (YYYY-MM-DD),
    `acquiredfrom`, `invdate`, `invlocation`, `privatecomment`. This form is also the whole group:
    the Worker first reads it with `GET geekcollection.php?action=editdata&fieldname=ownership&collid=…&objectid=…&ajax=1`
    (HTML form, `ownership-editdata.html`), takes every current value, changes only price paid,
    currency, acquisition date and acquired from, and sends all fields back, so a comment,
    quantity or current value is never wiped. The answer is an HTML table of the saved values
    (`save-ownership.html`), which the adapter checks for the price it sent. A price in a
    currency BGG does not offer is converted to EUR by the app before saving (ECB rates of F007).
  - `cellid` is only an id for BGG's page and is sent as a fixed value.
  - **Mark as owned on a game not yet in the collection**: status save with empty `collid`, then
    the new `collid` is read through the official API as above, then the private info save. That
    is the one case with two writes per tap (FR-018 allows one tap = one decision).
- **Only changed fields** (FR-017, US4 #6): the Worker reads the current item right before saving
  and merges the person's changes into it, so a status changed meanwhile on the website survives.
- **Price conflict** (FR-031): if BGG already holds another price paid and the request does not say
  `replacePrice: true`, the Worker answers `409 price_conflict` with the current value; the app asks
  and repeats with `replacePrice` true or false.
- **Never**: deleting a collection item (FR-022), bulk or background writes (FR-018); one save = at
  most one read and one write to BGG, through the same 1 request/s slot as all BGG access.
- **Alternatives**: a deep link "Edit on BGG" only (the first suggestion; rejected by the owner: the
  point is to decide in the app); a browser extension (another product); a shared app account on
  BGG (would write into the wrong collection).

## R4. Where the BGG session lives

- **Decision**: in an **HttpOnly, Secure, SameSite=Strict cookie on the app's own origin**, path
  `/api/bgg/account`, set by the Worker after sign-in, holding the BGG cookies **encrypted with
  AES-GCM** under a Worker secret (`BGG_SESSION_KEY`) together with the app person's email and the
  BGG username. Lifetime: BGG's session lifetime, at most 30 days.
- **Why**:
  - Browser scripts cannot read an HttpOnly cookie, so a script bug (XSS) cannot steal the
    session; other sites cannot send it (SameSite=Strict, and the whole host sits behind Access).
  - It stays on the device and is not in IndexedDB, the sync, backups or shared texts (FR-012).
  - Encrypted under a Worker secret, a copied cookie is useless against BGG directly; the Worker
    decrypts it only for one write and keeps nothing (FR-013).
  - The email inside binds it to one app person: another person in the same browser gets "not
    signed in" (US3 #5); signing out of BGG clears it (`Max-Age=0`), and the app's sign-out calls
    the same route first (FR-014).
- **Alternatives**: `localStorage`/IndexedDB (the user's first idea): readable by any script of
  the origin and copied into the device's storage dumps; the cookie is the stronger version of
  "only this app, only this device". Storing the session in the database: contradicts FR-012 and
  would make the server a store of other people's BGG sessions.
- **Logging**: requests to `/api/bgg/account/*` never log bodies or the `Cookie` header; BGG
  errors are logged as status codes only.

## R5. The app's token stays with the official API

- **Finding**: `worker/bgg/cache.ts` adds the app's `Authorization: Bearer` header to every URL
  starting with `https://boardgamegeek.com/`. Website requests with a person's cookies must not
  carry it.
- **Decision**: the token is added only to `/xmlapi` and `/xmlapi2` paths; account requests use
  their own small fetch (no cache, cookies only) but share the throttle slot. A worker test proves
  that no website request carries the token and no API request carries a cookie.

## R6. What syncs and what stays on the device

| Data | Where | Why |
|---|---|---|
| BGG username | synced (new `user_setting` row) | FR-001: follows the person to other devices |
| Friends followed by link | synced (new `followed_bgg_user` rows, tombstones) | like loaded lists today |
| Statuses (own and friends') | device (IndexedDB store `bggCollections`, per BGG user, with `loadedAt`) | read from BGG; a cache, not the person's data |
| BGG session | device cookie, HttpOnly (R4) | FR-012 |
| Badge colours | device meta `badgeColours` | FR-033 ("remembered on the device") |
| Last used tab per place | device meta `lastTab` | FR-026 |

- Sync: `POST/GET /api/sync` gain `settings` and `follows` next to `collections`, `entries` and
  `lists`; same last-write-wins on `updatedAt` and `synced_at` cursor (ADR 0004).

## R7. Navigation, routes and the removed screens

- **Routes**: `#/buy` (Search), `#/buy/lists` (Shopping lists), `#/buy/lists/<id>` (a shopping
  list; old `#/collections/<id>…` addresses keep working and redirect), `#/lists/status`,
  `#/lists/previews`, `#/lists/geeklists`, `#/lists/status/<bggUser>/<status>`; existing
  `#/lists/preview/<id>` and `#/lists/geeklist/<id>` stay. Old `#/collections`, `#/search` and
  `#/buy/<bggId>` (price screen) map to the new places (`#/buy/<bggId>` → Buy › Search with the
  game's sheet open). Pure mapping in `router.ts`, unit-tested.
- **Removed**: the Search place (`Search.tsx`), the price screen (`Prices.tsx`), the game info
  sheet (`GameInfoSheet.tsx`), the hexagon category picker in the sheet; their tests move to the
  new game sheet or go.
- **One game sheet**: `GameSheet.tsx` becomes the single sheet with a `context` (`shopping` with the
  entry, or `browse`), replacing the list game sheet and the info sheet (design.md "Game sheet").

## R8. Badges and colours

- A pure `statusesOf(collection, bggId)` and `badgeOrder` in `src/domain/bgg-status.ts`; a hook
  `useBggStatuses()` exposes the person's own collection as a `Map<bggId, Status>` to every row,
  card and sheet; no badges without a username or before the first load (FR-008, edge cases).
- Colours: the ten palette names map to CSS custom properties in `theme/badges.css`; defaults per
  design.md; contrast pairs as in design.md §3 (dark text on cool, hot, mint, pink, white; white on
  violet, dusk, red, mud, grey).

## R9. Constitution

- Principle V forbids login sessions only inside the time-limited exception for reading website
  JSON; it does not cover writing to a person's own collection at all. Writing with the person's
  own session through BGG's website is new use of BGG and needs an explicit rule.
- **Decision**: propose amendment **1.4.0** (MINOR, new guidance under V): "Writing to a person's own
  BoardGameGeek collection MAY use BoardGameGeek's website with that person's own session, when the
  person triggers each write; the session stays on the person's device (encrypted, not readable by
  scripts), is never stored, cached or logged on the server; only the person's own collection is
  written, only statuses and the private info fields the person sees, never deletions; writes share
  the BGG throttle; the endpoint is confined to one adapter." Applied with `/speckit-constitution`
  once the owner accepts ADR 0009.
