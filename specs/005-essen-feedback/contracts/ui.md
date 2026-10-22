# Contract: API delta and UI (for tests)

## API delta

`GET /api/bgg/games?ids=…` ([contract](../../001-bgg-game-collection/contracts/api.md)): each game
gains `"rating": 7.88 | null` and `"geekRating": 7.73 | null` (BGG average and Bayes average, two
decimals as stored). Sync (`/api/sync`) accepts and returns entries with `mark: "later"`.
Upstream (server only): `https://api.geekdo.com/api/dynamicinfo?objectid=<id>&objecttype=thing`,
cached with the game, through the existing throttled client.

## Collection screen

| Element | Role / name |
|---|---|
| quick filters | group "Quick filters" |
| grouping toggle | button "Grouped by categories; tap to group by booths" (and the reverse); text "Cat" / "Booth", current one marked |
| Buy quick filter | button "🛒 Buy", `aria-pressed` |
| count | text "<n> games" |
| search | searchbox "Search <collection>", placeholder "Search this collection" |
| no match | text "No game called “<q>” here.", button "Clear the search" |
| group heading | button "<emoji> <label> <count>", `aria-expanded` (every group) |
| game row | button "<game>, <category>[, bought]" (opens details) |
| Buy action | button "Buy <game>" / "Not bought <game>", `aria-pressed` |
| Category action | button "Category of <game>" |
| Filter action | button "Filter" / "Filter (active)" with `is-active` while not default |
| no filter summary line | — (removed) |

## Sheets

| Sheet | Role / name | Content |
|---|---|---|
| Buy | dialog "Bought <game>" | textbox "Price paid", combobox "Currency", buttons Cancel, "Got it" |
| Category | dialog "Category of <game>" | one button per category ("⭐ Must Have" …), current `aria-pressed=true` |
| Filter and group | dialog "Filter and group" | groups Bought, Price, Categories (checkboxes), Group by (Categories / Booths); buttons "Clear filters" (disabled at default), "Done" |
| Copy / Move | dialog "Copy <game>" / "Move <game>" | combobox "To collection" (options "(already in it)" disabled), buttons Cancel, "Copy" / "Move" |
| Conflicts | dialog "Conflicts" | heading "<n> conflicts"; buttons "Use BGG for all", "Use own for all"; per conflict group "<field> of <game>" with buttons "Own <value>" / "BGG <value>" (`aria-pressed`); buttons "Later", "Apply" |

## Game details

| Element | Role / name |
|---|---|
| category picker | group "Category"; five buttons (emoji + label), `aria-pressed` |
| Not interested | button "🛑 Not interested" (on such a game: "↩ Interested again") |
| info box | term/definition pairs including "Rating" and "Geek rating" (when known) |
| copy / move | buttons "Copy to collection", "Move to collection" |

## BGG list

| Element | Role / name |
|---|---|
| resync | button "Resync with BGG" in the heading; disabled offline and while running |
| progress | the list status line "Resyncing with BGG… <n> / <total>" |
| result | toast "Resync done: <n> games updated[, <k> conflicts]" |

## BG-Tinder card

Group "Game: <game>" containing "publisher · year", the info box (as details, with ratings) and the
full description.

## Toasts

"<game>: got it for €24!" / "<game>: got it!" · "<game>: not bought any more" ·
"<game> → ⭐ Must Have" · "Copied <game> to <collection>" · "Moved <game> to <collection>" ·
"Filters cleared" · "<n> values taken from BGG" / "Your own values kept".
