# Research: List Filter

## R1. Where the game details come from

- **Decision**: the existing route `GET /api/bgg/games?ids=` (F006): official `thing` API with
  `stats=1`, 20 ids per BGG request, at most `fetchLimit` (40) fetched from BGG per call, the rest
  answered from the shared `game` table when fresher than 7 days. The app asks for the missing ids of
  a list in chunks of 40, one chunk after the other, and stores the answers in IndexedDB `games`.
- **Rationale**: no new BGG access; the throttle (1 request/s per isolate), cache and table already
  exist (ADR 0007, constitution V). A 300-game preview needs at most 15 BGG requests once; every
  later device or person reads the table.
- **Alternatives**: a new bulk route that reads a whole list at once (one long Worker request,
  subrequest limits, no progress); reading details while the list loads (wasteful when nobody
  filters).

## R2. Playing time

- **Decision**: map BGG's `playingtime` (`<playingtime value="45"/>`) to `playingTime` (minutes, null
  when 0 or missing) in `worker/bgg/official.ts`; new column `game.playing_time integer`; the
  migration sets `fetched_at` of all existing rows to `1970-01-01` so they are read again lazily
  (7-day freshness), and on the device a stored game without the key `playingTime` counts as
  "details missing" for the filter.
- **Rationale**: one value matches the spec (Assumptions: min/max time unused); stale rows refresh
  through the normal path without a bulk job.
- **Alternatives**: `maxplaytime` (often larger than what people expect); a one-off backfill job
  (bulk BGG traffic, against constitution V).
- **Website source** (no token, previews): `geekdo` items carry no playing time → `null`; the filter
  then shows them as "no length on BoardGameGeek".

## R3. Best / Recommended with n

- **Decision**: from the stored poll (`playerPoll`: per count best / recommended / notRecommended
  votes): n is **Best** when best votes are the largest of the three; **Recommended** when not best
  and best + recommended > notRecommended. Counts above the poll's largest row ("4+") use that row
  when n is larger than its number. Pure functions in `src/domain/player-poll.ts`.
- **Rationale**: matches BGG's own summary rule; the poll is already stored (F006).

## R4. Where filters live

- **Decision**: BGG list filters per list key (`status:<user>:<status>`, `preview:<id>`,
  `geeklist:<id>`) in IndexedDB meta `listFilters` (device only, like `activeFilter` of shopping
  lists); shopping lists keep `activeFilter` with new optional fields. The **length limits** are a
  synced setting: `user_setting.length_limits jsonb` (three increasing integers), pushed and pulled
  like `bggUsername`.
- **Rationale**: spec FR-007 (per device) and FR-008 (limits follow the person); no new table.

## R5. One filter model for both places

- **Decision**: `src/domain/game-filter.ts` with `GameFilter` (length ranges, players n + kinds,
  rating and geek rating ranges, mechanisms, designers), `matchesGame(details, filter, limits)`,
  `valueCounts(games)` (for the sheet's counts) and `missingCounts`. Shopping lists' `Filter` gains
  `game?: GameFilter`; `applyFilter` calls `matchesGame` with the entry's game details.
- **Rationale**: constitution III (pure domain), one implementation for both sheets (US5).

## R6. The rating slider

- **Decision**: two native `input type="range"` (0–10, step 0.1) stacked on one track; while a
  pointer drags, values within 0.2 of a whole number snap to it; keys are not snapped. Native ranges
  give keyboard and screen reader support for free.
- **Alternatives**: a slider library (new dependency, constitution IV).

## R7. Main button labels and Filter as main button

- **Decision**: `MainButton` gets a required short `caption` rendered inside the hexagon;
  `ActionBar` callers pass Tinder / New list / Load list / Add game / Filter. Previews, geeklists and
  friends' status lists render Filter as `MainButton` with an active dot.
