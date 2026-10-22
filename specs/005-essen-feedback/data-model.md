# Data model: Essen Feedback

Builds on [001 data-model](../001-bgg-game-collection/data-model.md). Only changes are listed.

## Category (domain `Mark`, `src/domain/marks.ts`)

| Key | Label | Emoji | Order |
|---|---|---|---|
| `new` | No category yet | ⬡ | 0 |
| `must_have` | Must Have | ⭐ | 1 |
| `interested` | Interested | 👀 | 2 |
| `unsure` | Unsure | 🤔 | 3 |
| `later` | For later | ⏳ | 4 — **new** |
| `poop` | Poop | 💩 | 5 |
| `skip` | Not interested | 🛑 | 6 |

- Stored in `collection_entry.mark` (text, no CHECK): **no migration**. Validation via `isMark`
  (Worker, backup restore) accepts `later` once `MARKS` has it.
- Collection groups: categorised first (Must Have … Poop), separator, then `new`, `skip`.
- Default folded groups per visit: `later`, `poop`, `skip`.

## Game (shared BGG cache, table `game`; domain `GameDetails`)

| Field | Type | Rule |
|---|---|---|
| `rating` | `numeric(4,2)` / `number \| null` | BGG `stats.average`; `null` when missing or ≤ 0 — **new** |
| `geek_rating` / `geekRating` | `numeric(4,2)` / `number \| null` | BGG `stats.baverage`; `null` when missing or ≤ 0 — **new** |

Migration `0005_ratings.sql`: add both columns (nullable); mark games stale
(`fetched_at = '2000-01-01'`) where both are null, so they are fetched again on demand.

Game info order (`gameInfos`): price, players, **rating**, **geek rating**, booth, edition,
designer, mechanisms. `rowInfos` skips `rating` and `geekRating` (rows unchanged).

## Entry (`collection_entry`) — unchanged schema

New operations (pure, `src/domain/membership.ts`):

- `copyEntry(entry, targetCollectionId, now)` → new live entry in the target: `mark`, `facts`,
  `factsSource` copied; `bought = false`, `paidCents = paidCurrency = null`; `detailsPending` copied.
- `moveEntry(entry, targetCollectionId, now)` → `[newEntry, tombstone]`: the new entry carries
  everything (mark, bought, paid, facts, source); the source becomes `deleted = true`.
- Both reject a target with a live entry for the same game.

## Facts reconcile (resync, `src/domain/facts.ts`)

```text
reconcileFacts(entries, fresh: Map<bggId, ListFacts>, declined: Record<key, string>, now)
  → { updates: Entry[], conflicts: Conflict[] }
Conflict = { collectionId, bggId, field: 'booth'|'price'|'publisher'|'edition', own: string, bgg: string }
key = `${collectionId}:${bggId}:${field}`
```

| Entry source | Field empty | Field equal | Field differs |
|---|---|---|---|
| none (`null`) | take list facts, source `preview` | — | — |
| `preview` | as `refreshPreviewFacts` (list wins) | unchanged | list wins |
| `manual` | filled from the list, source stays `manual` | unchanged | **conflict**, unless `declined[key]` equals the BGG value |

`price` compares cents and currency together and is shown as money ("€30" vs "€35").
`applyConflictChoices(entries, conflicts, choices, now)` → updated entries (BGG choices written;
source becomes `preview` when no hand-typed value remains different) and the new `declined` keys.

## Device meta (IndexedDB `meta`, per signed-in person)

| Key | Shape | Change |
|---|---|---|
| `activeFilter` | `Record<collectionId, StoredFilter>` | `StoredFilter` gains `buy?: { before: StoredFilter }` |
| `groupBy` | `Record<collectionId, 'mark' \| 'booth'>` | unchanged (labels "Categories" / "Booths") |
| `declinedFacts` | `Record<string, string>` | **new**: `collectionId:bggId:field` → declined BGG value |

`isDefaultView(filter, groupBy)`: all categories, bought `all`, price `all`, no `buy`, group by `mark`.
