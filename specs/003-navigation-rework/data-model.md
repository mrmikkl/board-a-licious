# Data Model: Navigation Rework with a Context-Aware Main Button

No stored data changes: no table, no migration, no IndexedDB key. Collections, entries, games and
lists are those of feature [001](../001-bgg-game-collection/data-model.md).

## Collection groups (domain, `src/domain/collection.ts`)

`groupByMark(entries, nameOf) → CollectionGroup[]`

| Field | Type | Notes |
|---|---|---|
| `mark` | `MarkInfo` | key, label, emoji (from `MARKS`) |
| `part` | `'marked' \| 'rest'` | `marked`: must_have, interested, unsure, poop; `rest`: new, skip |
| `entries` | `Entry[]` | live entries of that mark, sorted by name |

Order: must_have, interested, unsure, poop, new, skip; empty groups left out. `MARKS` itself keeps
its order (new first) for pickers, filters, counts and share text.

## Routes (in memory, `src/app/router.ts`)

| Route | Hash | New in 003 |
|---|---|---|
| `{ name: 'collections', create?: true }` | `#/collections`, `#/collections?new` | `create` opens New collection |
| `{ name: 'collection', id, open?: 'game' \| 'list' }` | `#/collections/<id>`, `…?add=game`, `…?add=list` | `open` opens Add game / BG-Tinder |
| `{ name: 'lists', load?: true }` | `#/lists`, `#/lists?load` | `load` opens Load a BGG list |
| `add` | — | removed; `#/add…` parses to the routes above (contracts/navigation.md) |

All other routes are unchanged.

## View state (in memory, per screen visit)

| State | Where | Default |
|---|---|---|
| menu open | AppBar | closed; closes on route change |
| Not yet marked folded | Collection | open |
| Not interested folded | Collection | closed |
| ticker running | Ticker | only when the name overflows and motion is allowed |
