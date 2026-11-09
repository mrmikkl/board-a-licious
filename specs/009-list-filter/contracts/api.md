# Contract: API changes

## `GET /api/bgg/games?ids=<1–50 ids>` (changed)

Each game gains `playingTime: number | null` (BGG `playingtime` in minutes; null when 0 or unknown).
Everything else unchanged (7-day freshness from the `game` table, at most `fetchLimit` new from BGG
per call; the app asks again for ids left out).

## `GET/POST /api/sync` (changed)

`settings[]` gains the optional `lengthLimits: [number, number, number]` (each 1–600, strictly
increasing; anything else → 400 `bad_request`). Absent = keep; `null` = defaults. Older app versions
that do not send it keep working.
