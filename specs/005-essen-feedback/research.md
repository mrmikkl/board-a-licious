# Research: Essen Feedback

Accepted ADRs read first: 0001–0006. No decision here binds later features beyond them; no new ADR.

## R1 · Where the ratings come from

- **Decision**: read BGG's `api.geekdo.com/api/dynamicinfo?objectid=<id>&objecttype=thing` in the
  existing `GeekdoSource`, alongside `api/geekitems`, when a game's details are fetched; take
  `item.stats.average` as **rating** and `item.stats.baverage` as **geek rating**, rounded to one
  decimal on display; `"0"` or missing means no value. Stored with the game (cached 7 days like the
  rest of the details). Recorded fixture: `tests/fixtures/bgg/dynamicinfo-295947.json` (fetched
  once on 2026-10-23 with the app's User-Agent: average 7.88, baverage 7.73).
- **Rationale**: `geekitems` (already used) has no ratings; the official XML API (`thing?stats=1`)
  still needs the token (ADR 0005). `dynamicinfo` is the public JSON BGG's own game pages use, so it
  falls under the constitution V time-limited exception, behind the same adapter, throttle (1/s),
  honest User-Agent and cache. The `XmlApiSource` later gets the same fields from `stats=1`.
- **Cost**: one extra BGG request per game whose details are fetched (2 instead of 1). Games cached
  before this feature are marked stale by the migration only where both ratings are missing, and are
  fetched again on demand (when their details are needed), not all at once.
- **Alternatives**: scrape the game page (fragile, against the spirit of V); show no ratings until the
  token exists (the user wants them at the fair).

## R2 · The new category "For later"

- **Decision**: a new key `later` in `MARKS` (`src/domain/marks.ts`), label "For later", emoji ⏳,
  between `unsure` and `poop`. Internal names (`Mark`, `mark` column, `markInfo`) stay; only texts say
  "Category" (spec assumption). Tone `[data-mark='later']` with the pink gradient.
- **Rationale**: the `mark` column has no CHECK constraint (migration 0001), the Worker and backup
  validate through `isMark`, and every list of marks (filter, counts, Show-off sheet, share text,
  pickers) iterates `MARKS`, so one entry reaches them all. No migration for entries.
- **Older app versions**: a sync or backup from a new client with `later` would fail `isMark` on an
  old client. The service worker already updates the app on the next start (vite-plugin-pwa
  `autoUpdate`); the group is 5–10 friends who update the same day. Accepted (spec assumption).
- **Alternatives**: renaming `mark` to `category` in code and database (large, risky during the fair,
  no user value).

## R3 · Game row with actions

- **Decision**: the row becomes a `div.row` (the bordered tile) holding a `button.row-open` (cover,
  name, infos → details) and two `button.row-act` (Buy, Category). Border: 1px transparent border with
  `background: linear-gradient(var(--deck)) padding-box, var(--tone) border-box`, which keeps the 1px
  width with a gradient (agreed in the review). The mark pill and the "✅ €paid" pill go; Buy shows the
  price paid as its label.
- **Rationale**: buttons cannot nest; separate buttons give each action its own accessible name.
- **Impact**: e2e tests that click a row by `role=button` with the game's name keep working (the
  open button carries the name); tests looking for the mark pill change.

## R4 · Row sheets (Buy, Category) as local state, not routes

- **Decision**: the Buy sheet and the Category sheet open from component state in `Collection.tsx`
  (like the details sheet's own steps), not from the hash route.
- **Rationale**: they are one-tap confirmations about one row; a route would add history entries the
  user must Back through at the booth. Esc, scrim and pull-down close them (Sheet component).
- **Reuse**: the Buy sheet is the existing `PaidForm` of `GameSheet.tsx`, moved into its own
  component `BuySheet.tsx` and used by both; buying goes through the existing `buyGame` action
  (celebration, sound, toast). Un-buying uses the existing "not bought" action.

## R5 · Quick filters, default filter and Clear filters

- **Decision**: the Buy quick filter is part of the stored filter: `StoredFilter` gains
  `buy?: { before: StoredFilter }`. On: `groups = {must_have, interested, unsure}`, `bought = 'no'`,
  `price = 'all'`, the previous filter kept in `before`; off: restore `before`; any sheet change
  drops `buy`. `isDefault(filter, groupBy)` (domain) drives the Filter action's highlight; Clear
  filters writes `PRESETS.all` and `groupBy = 'mark'`. The `filter-summary` line is removed.
- **Rationale**: one source of truth per collection (`meta.activeFilter`, `meta.groupBy`) as today;
  the toggle is the same setting as "Group by".
- **Alternatives**: a separate `quickFilter` meta key (two truths to reconcile).

## R6 · Booths: hall numbers and Not interested

- **Decision**: `boothsOf` in `src/domain/booths.ts` also accepts a part that is only a hall number
  (`/^(HALL\s*)?\d+$/i`) as `{ hall, hallOnly: true }`; within a hall, full booths sort first (by
  booth, then name), then hall-only games by name; a game is listed once per hall.
  `groupByHall` no longer drops Not interested: it groups exactly the entries it is given, and the
  screen passes the filtered entries.
- **Rationale**: FR-019, FR-020; the filter already decides what is shown.

## R7 · Search in a collection

- **Decision**: a pure `matchesName(name, query)` in `src/domain/` (NFD, strip combining marks,
  lower case, `includes`), used by the collection and by the BGG list filter (which today only
  lower-cases). The query is screen state, not stored.

## R8 · Folding every group

- **Decision**: `GroupHeading` always renders the fold button; `Collection.tsx` keeps a set of folded
  group ids per visit, initially `later`, `poop`, `skip` (category grouping); halls and "No booth yet"
  start open. Not remembered (as today).

## R9 · Category picker honeycomb

- **Decision**: a `CategoryPicker` component for the details: five pointy-top hexagons positioned in
  a CSS grid of 6 half-columns × 2 rows (row 1: columns 1–2, 3–4, 5–6; row 2: columns 2–3, 4–5,
  pulled up by a quarter hexagon), max 88px each, 4px gaps; reuses the `.picker-btn` look. The
  generic `HexPicker` stays for other pickers.

## R10 · Resync a BGG list and conflicts

- **Decision**:
  1. The list screen's heading gets a Resync icon button. Resync forces a full reload of the list
     through the existing loader (`loadedPages = 0`, same throttled page loading; the existing
     per-page `refreshPreviewFacts` keeps updating preview-sourced facts).
  2. When the last page is stored, a pure `reconcileFacts(entries, fresh, declined)` in
     `src/domain/facts.ts` returns `{ updates, conflicts }`: for every live entry of a game on the
     list (any collection), empty fields (booth, price + currency, publisher, edition) are filled
     from the list; a field set by hand (`factsSource = 'manual'`) whose value differs is a
     conflict `{ collectionId, bggId, field, own, bgg }` unless the same BGG value was declined
     before. Updates are written in one `store.updateEntries` transaction (outbox, sync).
  3. The UI shows a toast with counts and, with conflicts, the Conflicts sheet. Apply writes the BGG
     choices (field value; the entry's source stays `manual` while any own value remains, else
     `preview`) and records declined values.
- **Declined values** live on the device only: meta key `declinedFacts: Record<string, string>`
  keyed `collectionId:bggId:field` → the declined BGG value. Rationale: YAGNI; a friend's second
  device asking once more is harmless; no schema change.
- **Offline / BGG busy**: the button is disabled offline; a 503/502 during reload shows the list's
  existing error line and the toast "BoardGameGeek is busy. Try the resync again in a minute."; no
  reconcile runs on a partial list.

## R11 · Copy and move to another collection

- **Decision**: pure `copyEntry(entry, targetId, now)` and `moveEntry(entry, targetId, now)` in
  `src/domain/membership.ts`. Copy: new entry in the target with mark, facts and factsSource, not
  bought. Move: new entry with everything (mark, bought, paid, facts) plus a tombstone of the source
  entry. Both refuse a target that already holds the game (live entry). Written through the store's
  outbox like any change; works offline. The sheet uses the existing collection dropdown pattern
  ("(already in it)" disabled).
- **Alternatives**: reuse `membershipChanges` (it creates fresh entries without category and facts).

## R12 · BG-Tinder card shows the details' content

- **Decision**: the swipe card renders the same parts as the details sheet: "publisher · year", the
  framed info box (`facts-box` with `InfoList`, ratings included), then the full description (the
  3-line clamp goes; the card already scrolls vertically). `rowInfos` excludes the rating keys so rows
  stay as they are.
