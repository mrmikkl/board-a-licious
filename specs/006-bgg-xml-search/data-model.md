# Data Model: Official BGG Data and Search

No migration; no change to collections, entries, sync or IndexedDB.

## Game (existing, `game` table and `Game` type)

Unchanged fields: `bggId`, `name`, `year`, `thumbnailUrl`, `description`, `kind`
(`boardgame` | `expansion`), `minPlayers`, `maxPlayers`, `designers`, `mechanisms`, `publisher`,
`rating`, `geekRating`. With a token they are filled from `xmlapi2/thing` (mapping: research R4).
Rows older than 7 days are refetched on demand, then from the official API.

## SearchResult (new, not stored on the device)

| Field | Type | Rule |
|---|---|---|
| `bggId` | positive integer | unique within one answer (duplicates merged, expansion wins) |
| `name` | string | BGG's primary name, else the first name given |
| `year` | integer \| null | `yearpublished` > 0, else null ("Year unknown") |
| `kind` | `boardgame` \| `expansion` | from the item `type` |

Order: `rankResults` (exact, prefix, rest; shorter name, then alphabetical); at most `limit` (1–50).
Cached on the server per normalised query for 1 day.

## SearchQuery (domain)

`searchQuery(text)`: trimmed, inner whitespace collapsed; valid for 2–100 characters, else
`{ ok: false, reason: 'short' | 'long' }`. Cache key: the valid query in lower case.

## GameInput (domain, Add game)

`parseGameInput(text)` → `{ kind: 'empty' }` | `{ kind: 'link', link: GameLink }` (existing
`parseGameLink` result, valid or with its message) | `{ kind: 'name', query: SearchQuery }`.

## BggSources (Worker)

`{ games, search, geeklist, preview, companies, gallery }`, each a `BggSource` implementation;
chosen per kind as in research R2. With a token, `games`, `search` and `geeklist` use
`OfficialSource`; the rest use `GeekdoSource`. Both share one throttled client (one request per
second per isolate).

## Search state (app, `useBggSearch`)

`idle → short | loading`; `loading → done | waiting → done | offline | unavailable`; a new text
starts over from `idle`/`loading` and drops the older answer. `noToken` replaces all of them when
`/api/me` says `bggSearch: false`.
