# Data Model: Share from BGG into the App

No new tables, no migration, no new server data. Collections, entries and games are those of feature
001 ([data-model](../001-bgg-game-collection/data-model.md)); a shared game becomes an ordinary
entry, exactly as when added by link.

## Shared item (in memory only)

What the phone hands to the app; never stored.

| Field | Type | Notes |
|---|---|---|
| `title` | string, optional | page title (Chrome) or app-provided title |
| `text` | string, optional | shared text; BGG's app puts the link here |
| `url` | string, optional | shared link (Chrome) |

## Share reading (domain, `src/domain/shared.ts`)

`readShare(item) → SharedResult`

| Result | Fields | When |
|---|---|---|
| `{ kind: "game" }` | `bggId: number`, `suggestedName: string` | a BGG game or expansion link was found |
| `{ kind: "list" }` | `ref: { kind: "preview" \| "geeklist", id: number }` | a BGG preview or geeklist link was found |
| `{ kind: "none" }` | `shown: string` (the first link, else the text, trimmed to 200 chars) | anything else |

Rules: see [research.md](research.md) R4. The first BGG link in `url`, `text`, `title` (in this
order) decides; `suggestedName` is never empty (falls back to the slug name, then "Game <id>").

## Last share collection (device, IndexedDB meta)

| Key | Value | Notes |
|---|---|---|
| `lastShareCollection` | collection id (string) | set after each successful add from a share; ignored when that collection no longer exists or was deleted |

## Validation

- A shared game added to a collection follows 001's entry validation (positive `bggId`, mark `new`,
  `detailsPending: true` unless the device knows the game).
- A name typed in the sheet is trimmed; empty means the suggested name.
- The collection name for "Create and add" follows 001 (1–60 characters).
