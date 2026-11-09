# Contract: UI names the tests rely on

- Main buttons carry a caption inside: "Tinder", "New list", "Load list", "Add game", "Filter"
  (`aria-hidden`); accessible names unchanged ("BG-Tinder: swipe a BGG list into this shopping list",
  "Create a shopping list", "Load a BGG list", "Add a game to <status>", "Filter" / "Filter (active)").
- BGG lists: Filter is the main button in previews, geeklists and friends' status lists; an action
  "Filter" / "Filter (active)" in own status lists. Count line role `status`: "<n> of <N> games".
- Sheet `dialog` "Filter" (shopping lists: "Filter and group"); buttons "Clear filters" (two: top and
  bottom), "Done · <n> games".
- Groups: "Length" (toggle buttons "Short · 0–30 min" …), "Number of players" (toggle buttons 1–6 and
  the field "Other number of players"), "With <n> players the game is" (toggle buttons "Best",
  "Recommended"), sliders "Rating from", "Rating to", "Geek rating from", "Geek rating to", groups
  "Mechanisms" and "Designers" (checkboxes named by value), searchboxes "Find in Mechanisms",
  "Find in Designers".
- Reading: status "Reading game details from BoardGameGeek… <n> of <N>".
- Config: section heading "Game length", fields "Short ends at minutes", "Middle ends at minutes",
  "Long ends at minutes", buttons "Reset", "Save game length"; toast "Saved the game length".
