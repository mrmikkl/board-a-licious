# Contract: UI (for tests)

## Menu

| Element | Role / name |
|---|---|
| Buy | first link "Buy" in the menu, before "Collections" |

## Buy (`#/buy`)

| Element | Role / name |
|---|---|
| heading | heading "Buy" |
| field | searchbox "Find a game's prices"; hint "Type at least 2 letters." |
| result | button "<game>, <year>[, expansion]" (no add button); opens `#/buy/<bggId>` |
| action bar | none |

## Price screen (`#/buy/<bggId>`) and Prices section

| Element | Role / name |
|---|---|
| back | link "Back" (price screen) |
| heading | heading "Prices" (price screen) |
| Prices section | button "Prices", `aria-expanded` (details, game info sheet) |
| language | group "Language": buttons "Both", "English", "German", `aria-pressed` |
| fair price | text "At the fair: €38,00" (when known) |
| New / Used | buttons "New …" / "Used …", `aria-expanded`; lists "New offers" / "Used offers" |
| offer | link "<seller>, <total>, <English\|German\|language unknown\|language not stated>[, used][, not in stock]", opens in a new tab |
| unknown switch | checkbox "Show offers with unknown language (n)" (price screen) |
| links | links "Search on Kleinanzeigen", "Search on eBay.de" (without keys), "Search on unknowns.de" (its marketplace search) |
| failed | text "<source> is not reachable right now.", button "Retry" |
| loading | status "Looking for prices…" |
| none | heading "No offers in English or German found", link "Open on brettspielpreise.de" |
| sources | text naming the sources and the prices' age, with a link to brettspielpreise.de (its terms) |
