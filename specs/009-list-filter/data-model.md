# Data Model: List Filter

## GameFilter (domain, `src/domain/game-filter.ts`)

| Field | Type | Default | Rule |
|---|---|---|---|
| `length` | `LengthRange[]` (`'short' \| 'middle' \| 'long' \| 'veryLong'`) | `[]` | OR inside; empty = any |
| `players` | `{ n: number; kinds: ('best' \| 'rec')[] } \| null` | `null` | n 1–99; kinds non-empty, default both; best or recommended with n |
| `rating` | `[from, to]` numbers 0–10, step 0.1 | `[0, 10]` | full width = no filter; from ≤ to |
| `geekRating` | same | `[0, 10]` | same |
| `mechanisms` | `string[]` | `[]` | AND inside |
| `designers` | `string[]` | `[]` | AND inside |

A game without the value a set section needs does not match that section (FR-006). Sections combine
with AND.

## LengthLimits (synced setting)

Three integers `[shortEnd, middleEnd, longEnd]`, default `[30, 60, 120]`, each 1–600, strictly
increasing. Short = 0…shortEnd, Middle = shortEnd+1…middleEnd, Long = middleEnd+1…longEnd,
Very long = longEnd+1 and more.

- PostgreSQL: `user_setting.length_limits jsonb NULL` (null = defaults), migration `0008_list_filter.sql`.
- Sync: `settings[].lengthLimits?: [number, number, number]` (validated; last write wins with the
  setting's `updatedAt`).
- Device: meta `bggSetting` gains `lengthLimits`.

## Game details (extended)

- `Game.playingTime?: number | null` (minutes). Absent key = stored before F009 → details missing for
  the filter and read again.
- PostgreSQL: `game.playing_time integer NULL`; migration sets `fetched_at = '1970-01-01'` for existing
  rows.

## Stored filters (device)

- Meta `listFilters: Record<listKey, StoredGameFilter>`; list keys `status:<bggUser lower>:<status>`,
  `preview:<id>`, `geeklist:<id>`.
- Meta `activeFilter[collectionId]` (shopping lists) gains `game?: StoredGameFilter`.
