# Data Model: BGG Game Collection

> **Status**: Outdated. Written before the design session of 2026-10-17, which reshaped the spec
> (several collections, Essen type, facts, swiping, marks incl. Unsure / Not interested, bought with
> price, filter). Re-run `/speckit-plan`; accepted ADRs in `docs/adr/` stay valid.

## Domain entities (shared by app and Worker, `src/domain/`)

### State

| Key | Label | Share emoji |
|---|---|---|
| `interested` | Interested | 👀 |
| `must_have` | Must Have | ⭐ |
| `poop` | Poop | 💩 |

- Defined once in `src/domain/states.ts` as an ordered list; display order = list order.
- Stored as the key string. Adding a state = adding a list item; no stored data changes (FR-006).
- Unknown keys (e.g. from a newer backup) are rejected on import with a clear message.

### Game (from BGG, not owned by the app)

| Field | Type | Notes |
|---|---|---|
| `bggId` | positive integer | BGG thing ID; identity |
| `name` | string, non-empty | primary name |
| `year` | integer \| null | year published |
| `thumbnailUrl` | https URL \| null | BGG CDN URL; placeholder when null |
| `kind` | `boardgame` \| `expansion` | |

Link to BGG is derived: `https://boardgamegeek.com/boardgame/{bggId}`.

### CollectionEntry (owned by the user)

| Field | Type | Rules |
|---|---|---|
| `bggId` | integer | unique per user |
| `state` | State key | required while not deleted |
| `name`, `year`, `thumbnailUrl` | from Game | cached display data (Principle V) |
| `updatedAt` | ISO-8601 UTC, ms precision | set by the client on every change |
| `deleted` | boolean | tombstone; hidden in UI, kept for sync |
| `detailsPending` | boolean | true when added by link; cleared once BGG details are filled (FR-019) |

State transitions:

```
(not in collection) --set state--> active(state)
active(s1)          --set state--> active(s2)
active(s)           --remove-----> deleted (tombstone)
deleted             --set state--> active(state)
```

Merge rule (sync, import with "backup wins"): for the same `bggId`, the entry with the later
`updatedAt` wins; equal timestamps keep the server copy.

### Change (outbox item, client only)

`{ bggId, state | null, name, year, thumbnailUrl, detailsPending, updatedAt }`; `state: null` means
remove.
Removed from the outbox when the server acknowledges it.

### Game link (pasted, FR-018)

Accepted: `https://(www.)boardgamegeek.com/(boardgame|boardgameexpansion)/<id>[/<slug>][?…]`, with or
without `https://`, plus surrounding text (e.g. a shared message). Suggested name = slug with `-`
replaced by spaces, each word capitalised (`ark-nova` → `Ark Nova`); empty when there is no slug,
then the user must type a name. Other BGG links (geeklist, user, thread) are rejected with a hint.

### Geeklist (transient, from BGG)

`{ id, title, entries: [{ bggId, name, kind, thumbnailUrl? }] }`, in geeklist order; non-game
entries are dropped (from `api.geekdo.com`: keep items whose `href` starts with `/boardgame/` or
`/boardgameexpansion/`). Opened geeklists (`id`, `title`, `openedAt`, `loadedPages`, `pageCount`)
and all their loaded entries are stored per device in IndexedDB (FR-004, FR-020); the search screen
searches these entries (name contains query, case- and accent-insensitive), one result per game.

## PostgreSQL schema (Neon)

```sql
CREATE TABLE collection_entry (
  user_email     text        NOT NULL,          -- verified email from the Access JWT, lowercased
  bgg_id         integer     NOT NULL CHECK (bgg_id > 0),
  state          text,                           -- NULL only when deleted
  name           text        NOT NULL,
  year           integer,
  thumbnail_url  text,
  updated_at     timestamptz NOT NULL,
  deleted        boolean     NOT NULL DEFAULT false,
  details_pending boolean    NOT NULL DEFAULT false,  -- added by link, BGG details not yet loaded
  PRIMARY KEY (user_email, bgg_id),
  CHECK (deleted OR state IS NOT NULL)
);
```

- Every query filters by `user_email` from the verified JWT; it is never taken from the request
  body or URL.
- Upsert applies the merge rule in SQL:
  `ON CONFLICT (user_email, bgg_id) DO UPDATE … WHERE excluded.updated_at > collection_entry.updated_at`.
- Migrations: plain numbered SQL files in `migrations/`.

## Browser storage (IndexedDB, database `board-a-licious`)

| Store | Key | Content |
|---|---|---|
| `entries` | `bggId` | CollectionEntry (incl. tombstones) |
| `outbox` | auto-increment | Change |
| `geeklists` | `id` | opened geeklists with load progress |
| `geeklistEntries` | `[geeklistId, position]` | loaded entries; index on `bggId` and normalised name |
| `meta` | name | `lastSyncAt`, `userEmail` (clears local data if a different user signs in) |
