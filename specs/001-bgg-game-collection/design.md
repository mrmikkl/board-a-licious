# Feature design: BGG Game Collection

**Design rules**: [docs/design.md](../../docs/design.md) v1.8.0 | **Prototype**: [design/prototype.html](design/prototype.html)
(first iteration kept as [design/prototype-v1.html](design/prototype-v1.html)) | **Agreed**: 2026-10-17

Open the prototype in a desktop browser and switch the developer tools to device mode (phone size).
It uses sample data; invented games get generated covers.

## Navigation

Tab bar: **Collections**, **Lists**, **+** (add), **Search** (switched off until Release 1.0,
without a "soon" label), **Config**. Sound is switched in Config only.

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Intro** (first start) | 3 swipeable cards: Collections, BGG lists, Swipe then hunt; Skip / Next / Let's go | Collections |
| **Collections** | one card per collection (name, "y not marked", the six counts ⭐ 👀 🤔 💩 ✅ 🛑 in one row, hexagon cluster); "Create a collection" card | Collection, Add (collection) |
| **Collection** | "Add by list" (primary) and "Add game", both opening a sheet over the collection; filter icon in the header opens "Filter and group" (Bought, Price: All / Cheap ≤30 / Mid ≤60 / Expensive, group checkboxes with Select all / Select none; Group by: Marks / Booth (hall)); a summary line only while narrowed; bought summary line ("✅ 1 game bought, €52 spent"); separator; groups in mark order, unmarked first, Not interested collapsed; game rows: name and year, publisher, the first three game infos. Empty collection: centred empty state with both add buttons. | Game details, Add by list, Add game |
| **Game details** (sheet) | cover, name, year, publisher, BGG link, description, all game infos in order (price, players, booth, edition, designer, mechanisms as pills; "➕ Add booth, price and publisher" / "✎ Edit"), mark picker (4 equal hexagons; choosing a mark closes the sheet and moves the game to its group), "✅ Bought it" → "What did you pay?" (prefilled with the listed price) → "Save, got it" / "Don't track the price"; "🛑 Not interested" / "Mark as not yet decided"; "Remove from collection" | – |
| **Swipe** | source note (which list); card stack (cards show all game infos); ✓ / ✕; games left; arrow keys | back to Collection |
| **Add by list** (sheet) | "Tinder style" line: swipe right to add, left to pass; segment "Select list" / "Add new list"; Select list: loaded lists, the chosen one highlighted, Cancel / "Select"; Add new list: BGG list link, Cancel / "Load list" | Swipe for that list |
| **Add game** (sheet) | "for games not on any of your lists", BoardGameGeek link, recognised game with editable name, Cancel / "Add to collection" | back to Collection |
| **Add (+)** | three hexagons: Collection, BGG list, Game | – |
| ↳ Collection | name, "Create collection" (enabled once a name is typed) | the new Collection |
| ↳ BGG list | link (preview or geeklist), "Load list" (enabled once a link is pasted); previews bring booth, price, publisher and edition | the list |
| ↳ Game | link, recognised game, collection dropdown (always visible), hint, "Add game" | the chosen Collection |
| **Lists** | one card per loaded BGG list (loading progress); "Load a BGG list" card | List, Add (BGG list) |
| **List** | name filter; game rows (name and year, publisher, three game infos) and "in a collection" hint; **+** per row | List game sheet |
| **List game** (sheet) | cover, description, all game infos; "In collections": one tick per collection showing where the game is; Done applies adds and removals, Cancel discards | – |
| **Search** | "Searching all of BoardGameGeek comes soon" card; disabled search field and sample results; "Add a game by link instead" | Add (game) |
| **Config** | sections divided by separator lines: Sound ("Sound and vibration" switch); Introduction ("Show the intro again"); Share and backup (button); Developer (hidden: five taps on the "Config" heading show or hide links to GitHub, Cloudflare and Neon, remembered per device) | Share and backup |
| **Share and backup** | Share: pick a collection, pick groups, message preview (booth and price where known; bought games marked ✅), "Share list"; export / import backup | – |

## Rules shown in the UI

- Whatever a list has for a game (booth, price, publisher, edition) goes with it into any
  collection; nothing is said about what is missing. Booth, price and publisher can always be typed
  in by hand ("Added by you"). There are no Essen collections or Essen lists (dropped 2026-10-18).
- Game info order, everywhere: price, players, booth, edition, designer, mechanisms; unknown ones
  are left out. Publisher: the list's (or typed-in) publisher, else the game's first on BGG.
- Swipe right adds a game as "Not yet marked"; swipe left adds it as "Not interested". Games
  already in the collection are not shown again.
- Bought does not change a game's group; the filter's Bought segment selects bought / not bought.
- "Must Have, not bought" = Select none, tick Must Have, Bought: Not bought (no presets).

## Components introduced by this feature

All defined in [docs/design.md](../../docs/design.md) §7: collection card with hexagon cluster, game
row with publisher and game info lines and bought badge, game info (mechanism pills), group heading with collapsible variant, filter button and panel, separator,
hexagon picker (marks and add choice), multi-choice list with hexagon ticks, swipe card, empty state,
facts sheet with manual edit form, price question, intro cards.
