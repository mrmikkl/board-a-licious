# Data Model: BGG Game Collection

Re-planned 2026-10-17. Domain types live in `src/domain/` and are shared by app and Worker.

## Domain entities

### Mark

| Key | Label | Emoji | Order |
|---|---|---|---|
| `new` | Not yet marked | ⬡ | 1 (default) |
| `must_have` | Must Have | ⭐ | 2 |
| `interested` | Interested | 👀 | 3 |
| `unsure` | Unsure | 🤔 | 4 |
| `poop` | Poop | 💩 | 5 |
| `skip` | Not interested | 🛑 | 6 (collapsed by default) |

Defined once in `src/domain/marks.ts`; stored as the key. New marks = new list items, no data change
(FR-004). Unknown keys from a newer backup are rejected on import.

### Game (from BGG, shared cache)

| Field | Type | Notes |
|---|---|---|
| `bggId` | positive integer | identity |
| `name` | string | primary name |
| `year` | integer \| null | year published |
| `thumbnailUrl` | https URL \| null | BGG image CDN |
| `description` | string \| null | BGG `short_description` |
| `kind` | `boardgame` \| `expansion` | |
| `fetchedAt` | timestamp | refresh after 7 days |

Link derived: `https://boardgamegeek.com/boardgame/{bggId}`.

### Collection

| Field | Type | Rules |
|---|---|---|
| `id` | UUID (client-generated) | identity, works offline |
| `name` | string, 1–60 chars, trimmed | required |
| `type` | `essen` \| `standard` | fixed after creation |
| `updatedAt` | ISO timestamp (ms) | set by client |
| `deleted` | boolean | tombstone for sync |

### Collection entry

| Field | Type | Rules |
|---|---|---|
| `collectionId` + `bggId` | key | a game once per collection (FR-003) |
| `mark` | Mark key | default `new` |
| `bought` | boolean | independent of `mark` (FR-007) |
| `paidCents` | integer ≥ 0 \| null | price paid; null = not tracked |
| `paidCurrency` | ISO 4217 code \| null | currency of the price paid; from `facts.currency`, else `EUR` (FR-008) |
| `facts` | `{ booth, priceCents, currency, publisher }` \| null | each part optional |
| `factsSource` | `preview` \| `manual` \| null | `manual` shows "Added by you" (FR-011) |
| `detailsPending` | boolean | added by link, BGG details not loaded yet (FR-017) |
| `updatedAt` | ISO timestamp (ms) | set by client on every change |
| `deleted` | boolean | tombstone for sync |

Rules (all in `src/domain/`):

- **Facts rule (FR-010)**: when adding from a list, `facts` are copied only if the list is a preview
  and the collection is `essen`; otherwise `facts = null`. `facts.ts` also returns the reason text
  the UI shows ("Booth, price and publisher are kept" / "Added without booth and price: …").
- **Swipe (FR-015)**: right → entry with `mark = new`; left → `mark = skip`. Games that already
  have an entry in the collection (including `skip`) are not offered.
- **Membership choice (FR-014)**: input = collection IDs before and after; output = adds and
  removals; a removal sets `deleted = true` (mark, bought and price go with it).
- **Bought (FR-007/008)**: marking bought suggests `paidCents` and `paidCurrency` from `facts`
  (currency defaults to `EUR`); un-buying clears both. Spent = Σ `paidCents` of bought entries,
  grouped by `paidCurrency`.
- **Deleting a collection (FR-001a)**: sets `deleted = true` on the collection and all its entries.
- **Filter (FR-009)**: `{ groups: Set<Mark>, bought: 'all' | 'no' | 'yes' }`; presets `all` and
  `hunt` = `{ groups: {must_have}, bought: 'no' }`.
- **Merge**: per entry (and per collection) the later `updatedAt` wins; equal → server copy.

### BGG list (games per device; the list itself per person)

Which lists a person loaded syncs to their other devices as a `LoadedList` (`kind`, `id`,
`title`, `isEssen`, `updatedAt`, `deleted`; table `loaded_list`, last write wins). A device that
gets one from sync shows it with `pageCount: 0` and loads the pages when it is opened.

| Field | Type | Notes |
|---|---|---|
| `kind` + `id` | `preview` \| `geeklist`, integer | identity, from the pasted link |
| `title` | string | from BGG |
| `isEssen` | boolean | `true` for previews (research R9) |
| `pageCount`, `loadedPages` | integers | background loading progress |
| `items` | `{ position, bggId, facts?, page }[]` | every item as BGG lists it (one per edition or publisher) |
| `entries` | same shape | one per game, editions merged (`mergeListEntries`: all booths and publishers) |
| `openedAt` | timestamp | |

Publishers: `{ companyId → name }` cache.

## PostgreSQL schema (Neon)

```sql
CREATE TABLE collection (
  id          uuid        PRIMARY KEY,
  user_email  text        NOT NULL,            -- verified Access email, lowercased
  name        text        NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  type        text        NOT NULL CHECK (type IN ('essen', 'standard')),
  updated_at  timestamptz NOT NULL,
  deleted     boolean     NOT NULL DEFAULT false
);
CREATE INDEX ON collection (user_email);

CREATE TABLE collection_entry (
  collection_id   uuid        NOT NULL REFERENCES collection (id),
  bgg_id          integer     NOT NULL CHECK (bgg_id > 0),
  user_email      text        NOT NULL,        -- denormalised for the per-user filter
  mark            text        NOT NULL DEFAULT 'new',
  bought          boolean     NOT NULL DEFAULT false,
  paid_cents      integer     CHECK (paid_cents >= 0),
  paid_currency   text,
  booth           text,
  price_cents     integer     CHECK (price_cents >= 0),
  currency        text,
  publisher       text,
  facts_source    text        CHECK (facts_source IN ('preview', 'manual')),
  details_pending boolean     NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL,
  deleted         boolean     NOT NULL DEFAULT false,
  PRIMARY KEY (collection_id, bgg_id)
);
CREATE INDEX ON collection_entry (user_email, updated_at);

CREATE TABLE game (                            -- public BGG display data, shared by all users
  bgg_id        integer PRIMARY KEY,
  name          text NOT NULL,
  year          integer,
  thumbnail_url text,
  description   text,
  kind          text NOT NULL DEFAULT 'boardgame',
  fetched_at    timestamptz NOT NULL
);
```

- Every collection and entry query filters by `user_email` from the verified JWT, never from input.
- Upserts apply last-write-wins in SQL (`… DO UPDATE … WHERE excluded.updated_at > t.updated_at`).
- Marks are validated in the domain, not by a CHECK, so new marks need no migration.

## Browser storage (IndexedDB `board-a-licious-<userEmail>`, one database per signed-in person)

| Store | Key | Content |
|---|---|---|
| `collections` | `id` | Collection (incl. tombstones) |
| `entries` | `[collectionId, bggId]` | Collection entry; index on `collectionId` |
| `outbox` | auto-increment | pending changes (collection or entry) |
| `games` | `bggId` | Game cache |
| `lists` | `[kind, id]` | BGG list incl. entries; index on normalised game name |
| `publishers` | `companyId` | name |
| `meta` | name | `lastSyncAt`, `userEmail`, `soundOn` (default true), `introSeen`, `activeFilter` (per collection ID) |
