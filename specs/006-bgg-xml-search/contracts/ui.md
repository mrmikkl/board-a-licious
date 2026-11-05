# Contract: UI (for tests)

## Search place (`#/search`)

| Element | Role / name |
|---|---|
| heading | heading "Search" |
| field | searchbox "Search BoardGameGeek", placeholder "Game name, e.g. Cascadia"; hint "Type at least 2 letters." |
| action bar | none (no `navigation "Actions"`) |
| status | status line: "<n> games · exact matches first", "50 games · the first 50, exact matches first", "Searching BoardGameGeek…", "BoardGameGeek asks us to wait a moment… still searching", "Type at least 2 letters.", "At most 100 letters." |
| result | button "<game>, <year>[, expansion]" ("Year unknown" when none), described by "in <collection>" / "in <n> collections" |
| add | button "Add <game> to a collection" next to each result |
| more | text "More games match. Type more of the name to narrow it down." (at 50) |
| no match | heading "No game called “<q>” on BoardGameGeek", text "Check the spelling, or try a shorter part of the name." |
| offline | text "You're offline. Searching needs a connection.", button "Try again" |
| not reachable | text "BoardGameGeek is not reachable. Try again in a moment.", button "Try again" |
| no token | heading "Searching all of BoardGameGeek comes soon", disabled field, no action bar |

## Sheets

| Sheet | Role / name | Content |
|---|---|---|
| Game info | dialog "<game>" | button "Show the images of <game> big", "<year> · [Expansion · ]<publisher>", link "Open on BoardGameGeek", description, info box (Players, Rating, Geek rating, Designers, Mechanisms, Publisher; "From BoardGameGeek"), button "Close"; no checkboxes, no category group |
| Add to collections | dialog "Add <game>" | one checkbox per collection (name, note), group "Category", buttons "Done", "Cancel"; toast "Added <game> to <n> collection(s)[. Removed it from <n> collection(s)]" |
| Add game | dialog "Add game" | textbox "Game name or BoardGameGeek link"; list "Matching games" of up to 8 buttons "<game>, <year>[, expansion]" (no add buttons); after a pick: heading "Found game ID <id>", button "Change", textbox "Name", group "Category", buttons "Cancel", "Add to collection"; text "This game is already in <collection>." disables it |
