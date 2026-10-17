# Feature design: BGG Game Collection

**Design rules**: [docs/design.md](../../docs/design.md) v1.2.0 | **Prototype**: [design/prototype.html](design/prototype.html)
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
| **Collections** | one card per collection (name, Essen badge, counts per mark and bought, hexagon cluster); "Create a collection" card | Collection, Add (collection) |
| **Collection** | "Add by list" (primary), "Add by link"; filter button + panel (presets, Bought segment, group checkboxes); bought summary line ("✅ 1 game bought, €52 spent"); separator; groups in mark order, unmarked first, Not interested collapsed. Empty collection: centred empty state with both add buttons. | Game details, Swipe, Add by link (in collection) |
| **Game details** (sheet) | cover, name, year, BGG link, description, booth/price/publisher (or "➕ Add booth, price and publisher" / "✎ Edit"), mark picker (4 equal hexagons; choosing a mark closes the sheet and moves the game to its group), "✅ Bought it" → "What did you pay?" (prefilled with the listed price) → "Save, got it" / "Don't track the price"; "🛑 Not interested" / "Mark as not yet decided"; "Remove from collection" | – |
| **Swipe** | source note (which list, whether facts are kept); card stack; ✓ / ✕; games left; arrow keys | back to Collection |
| **Add by link (in collection)** | link field, recognised game with editable name, "Add to ‹collection›" | back to Collection |
| **Add (+)** | three hexagons: Collection, BGG list, Game | – |
| ↳ Collection | name, "Essen collection" switch (on), "Create collection" (enabled once a name is typed) | the new Collection |
| ↳ BGG list | link (preview or geeklist), "Load list" (enabled once a link is pasted); previews are Essen automatically | the list |
| ↳ Game | link, recognised game, collection dropdown (always visible), hint, "Add game" | the chosen Collection |
| **Lists** | one card per loaded BGG list (Essen badge for previews, loading progress); "Load a BGG list" card | List, Add (BGG list) |
| **List** | name filter; rows with facts (Essen) and "in a collection" hint; **+** per row | List game sheet |
| **List game** (sheet) | cover, description, facts; "In collections": one tick per collection showing where the game is; Done applies adds and removals, Cancel discards | – |
| **Search** | "Searching all of BoardGameGeek comes soon" card; disabled search field and sample results; "Add a game by link instead" | Add (game) |
| **Config** | sections divided by separator lines: Sound ("Sound and vibration" switch); Introduction ("Show the intro again"); Share and backup (button) | Share and backup |
| **Share and backup** | Share: pick a collection, pick groups, message preview (Essen: booth and price; bought games marked ✅), "Share list"; export / import backup | – |

## Rules shown in the UI

- Booth, price and publisher are kept only when a game comes from an **Essen list** (a BGG preview) into an
  **Essen collection**; every other combination adds the game without them, and the UI says so
  before adding. They can always be typed in by hand ("Added by you").
- Swipe right adds a game as "Not yet marked"; swipe left adds it as "Not interested". Games
  already in the collection are not shown again.
- Bought does not change a game's group; the filter's Bought segment selects bought / not bought.
- "Must Have, not bought" preset = Must Have group + Not bought.

## Components introduced by this feature

All defined in [docs/design.md](../../docs/design.md) §7: collection card with hexagon cluster, game
row with bought badge, group heading with collapsible variant, filter button and panel, separator,
hexagon picker (marks and add choice), multi-choice list with hexagon ticks, swipe card, empty state,
facts sheet with manual edit form, price question, intro cards.
