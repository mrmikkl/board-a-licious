# Research: Official BGG Data and Search

Phase 0 of [plan.md](plan.md). Facts about BoardGameGeek's XML API from its page "Using the XML API"
and BGG's API documentation, **confirmed 2026-11-05 against real answers** recorded with the token in
`tests/fixtures/bgg-xml/` (T002, `scripts/record-bgg-xml.mjs`). Findings from the recording are
marked *Recorded*.

## R1. Sending the token

- **Decision**: every official request goes to `https://boardgamegeek.com/xmlapi2/…` or
  `https://boardgamegeek.com/xmlapi/…` (host without `www`) with the header
  `Authorization: Bearer <BGG_TOKEN>` and the existing honest `User-Agent`. The token is read from the
  Worker env only, passed into the client at construction, never put into URLs, cache keys, logs,
  error messages or `/api/me`.
- *Recorded*: `Authorization: Bearer` on `boardgamegeek.com` answered 200 for thing, search and
  geeklist.
- **Rationale**: BGG's documented form; a header keeps the token out of cache keys (the cache key is
  the URL) and out of request logs.
- **Alternatives**: token as a query parameter (would land in cache keys and logs).

## R2. Which data comes from where (constitution V)

- **Decision** (recorded as [ADR 0007](../../docs/adr/0007-bgg-source-per-kind-of-data.md)):

  | Kind of data | With token | Without token |
  |---|---|---|
  | Game details incl. ratings | official `xmlapi2/thing?id=…&stats=1` | website JSON (as today) |
  | Search | official `xmlapi2/search` | not available (503 `bgg_search_unavailable`) |
  | Geeklists | official `xmlapi/geeklist/<id>` (v1; v2 has none) | website JSON |
  | SPIEL previews (with booth, price, embedded game info) | website JSON (exception) | website JSON |
  | Company names (publishers named in previews) | website JSON (exception; the XML API has no company query) | website JSON |
  | Image galleries | website JSON (exception, feature 004 R1) | website JSON |

- The game info embedded in a preview page (players, designers) comes with the preview request
  itself; no separate website request for game details is made. SC-003 counts requests to
  `api/geekitems?objecttype=thing`, `api/dynamicinfo`, `api/geeklists` and `api/listitems`, which must
  be 0 with the token.
- **Alternatives**: one `XmlApiSource` replacing everything (ADR 0005's plan) breaks previews and
  galleries; keeping website data for game details is not allowed once the token exists.

## R3. Reading XML in the Worker

- **Decision**: `fast-xml-parser` v5 (`XMLParser` with `ignoreAttributes: false`,
  `attributeNamePrefix: ''`, `isArray` for `item`, `link`, `name`, `rank`; `processEntities: true`), plus decoding of numeric
  entities such as `&#10;` in descriptions, in `worker/bgg/xml.ts`.
- **Rationale**: Workers have no `DOMParser`; `HTMLRewriter` is not available in the Node worker tests;
  the library is pure JS, small, and widely used.
- **Alternatives**: hand-written regex extraction (fragile with entities and attribute order);
  `HTMLRewriter` (untestable in Node, streaming API is awkward for nested data).

## R4. Game details from `thing`

- **Decision**: `GET /xmlapi2/thing?id=<up to 20 ids>&stats=1`, one request per 20 ids. Mapping to
  the existing `Game` (unchanged fields): `name[type=primary].value` → name; `yearpublished.value`
  (0 → null); `thumbnail` → thumbnailUrl; `description` (entities decoded, `&#10;` → newline, trimmed)
  → description; `type` `boardgameexpansion` → kind `expansion`; `minplayers`/`maxplayers`;
  `link[type=boardgamedesigner|boardgamemechanic|boardgamepublisher]` (publisher: first); 
  `statistics.ratings.average` / `bayesaverage` → rating / geekRating (0 → null, rounded to two
  decimals as today). Unknown ids are simply missing from the answer → left out.
- *Recorded*: `thing` answers any item type for an id (374341 is an `rpgitem`); a `type` filter with
  two types answered "Invalid Item", so no `type` parameter is sent and items other than `boardgame`
  / `boardgameexpansion` are dropped in code. A game can have a rating but `bayesaverage` 0 (477191:
  8.19 / no geek rating). Cascadia's values match the website data (7.88 / 7.73 rounded).
- The games route fetches at most `source.fetchLimit` games per request: geekdo 10 (two requests per
  game), official 40 (two requests of 20).
- **Difference accepted**: the official description is BGG's full text, the website's was a short
  one; it is shown in the same places (FR-006 keeps fields and order; SC-004 compares fields other
  than the description's length).
- **Refresh**: games older than 7 days are refetched on demand as today; with the token that refetch
  goes to the official API, so old rows move over without a migration (US2 scenario 6).

## R5. Search

- **Decision**: `GET /xmlapi2/search?query=<q>&type=boardgame,boardgameexpansion`. Answers list
  `item[type, id]` with `name[type=primary|alternate, value]` and `yearpublished`; no covers. An
  expansion can appear twice (as `boardgame` and as `boardgameexpansion`): de-duplicate by id, an
  `expansion` entry wins. The shown name is the item's name (primary when present).
- *Recorded* ("cascad", 34 items): expansions appear twice (as `boardgame` and as
  `boardgameexpansion`); BGG also matches words inside names ("The Battle at Kemble's Cascade");
  some items carry only an `alternate` name (the matched one, e.g. 388406 "Cascade"); names contain
  entities (`&#039;`). Such a row shows that name until `/api/bgg/games` brings the primary name.
- **Ranking** (`rankResults` in `src/domain/bgg-search.ts`): exact match of the folded name (case and
  accents ignored) first, then names starting with the query, then the rest; within each group the
  shorter name first (closer match), then alphabetical; cut at the limit (50 for Search, 8 for Add game).
- **Changed from the prototype**: the prototype ordered games within a group by geek rating. Search
  answers carry no ratings; getting them for every match would need one `thing` request per 20
  matches before showing anything, breaking SC-002. Shorter-name-first gives the same feel for typical
  queries ("cascad" → Cascadia first). design.md is amended accordingly.
- **Covers**: the app requests `GET /api/bgg/games?ids=<shown ids>` after the results arrive (visible
  first, in chunks of 20); rows show initials until then (design rule "Search result row").
- **Cache**: search answers cached 1 day per normalised query (lower case, trimmed, single spaces) in
  the edge cache; `GET /api/bgg/search` caches the ranked result for the same key.

## R6. Geeklists

- **Decision**: `GET /xmlapi/geeklist/<id>` (XML API v1, the only official geeklist read). The answer
  holds the whole list (title, items with `objecttype`, `subtype`, `objectid`, `objectname`, `body`).
  `OfficialSource.getListPage` reads it once (cached 1 hour) and slices pages of 25, so page numbers,
  `pageCount` and positions stay as today. Only `objecttype="thing"` with subtype `boardgame` or
  `boardgameexpansion` count. Thumbnails are not in the answer → `thumbnailUrl: null`; the list
  screen already fills covers from `/api/bgg/games`.
- *Recorded*: 66420 answered 200 at once with all 34 items (`objecttype` `thing`, `geeklist` or
  `thread`; things with `subtype="boardgame"`), attributes spread over several lines. The 202 body in
  `geeklist-202.xml` is written by hand from BGG's documented message.
- **202 Accepted**: BGG queues large geeklists and answers 202 first. The client retries the same URL
  up to 3 times, 2 s apart (through the 1 request/s queue); still 202 → `bgg_rate_limited` with
  `Retry-After: 5`, which the list loader already handles as "wait and retry".

## R7. Errors

- 401/403 with the token → `BggError('bgg_unavailable', 'BoardGameGeek is not reachable.')`, plus
  `console.error('bgg token rejected', status)` (no token, no URL query) so the owner sees it in the
  Worker logs (FR-007). No fallback to website data for that request.
- 429 → `bgg_rate_limited` with BGG's `Retry-After` (default 60 s as today; 503 stays `bgg_unavailable` as before); the app shows
  the waiting state, not an error, for up to 10 s, then the "not reachable" note with Try again.
- Malformed XML → `bgg_unavailable` ("sent something unexpected").

## R8. Search in the app

- **Decision**: `useBggSearch(limit)` keeps the text, waits 0.5 s after the last change (Enter: at
  once), aborts the previous request (`AbortController`) and ignores answers whose sequence number is
  not the newest. States: idle, short (1 char / only spaces / > 100), loading (first or with old
  results dimmed), waiting (BGG asked to wait), done, offline (`navigator.onLine` false or fetch
  failed offline), unavailable, noToken (`/api/me` `bggSearch` false → Search shows today's card).
- "in <collection>" per row comes from the device's entries (no request).
- Not stored in IndexedDB; offline searches are not queued (spec edge case).

## R9. Add game: one field

- **Decision**: `parseGameInput(text)`: blank → empty; looks like a link (contains `boardgamegeek`,
  `bgg.`, `http`, or `/boardgame`) → existing `parseGameLink`; else a name. A name runs the same hook
  with limit 8; picking a match or a recognised link shows the Found game card (cover via
  `/api/bgg/games`, name editable, Change returns to the field). The rest of the sheet (category,
  already-in-collection check, Add to collection) is unchanged.
- Without a token, a name shows the hint "Searching by name needs BoardGameGeek access; paste the
  game's link instead." and links work as today.

## R10. Testing without BGG

- Recorded XML fixtures in `tests/fixtures/bgg-xml/` (thing with stats for 2 ids incl. an expansion
  and a game without ratings; search "cascad"; geeklist 202 then 200). Worker tests inject `fetch`.
- Playwright: the dev Worker without a token keeps today's behaviour (SC-006); search e2e tests
  intercept `/api/bgg/search` and `/api/bgg/games` with `page.route` and set `bggSearch: true` on
  `/api/me`, so no test calls BGG.
- Real check: `quickstart.md` runs against BGG once with the token as a local secret in `.dev.vars`
  (git-ignored), which the owner adds themselves.
