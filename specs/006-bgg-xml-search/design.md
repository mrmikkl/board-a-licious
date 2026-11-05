# Feature design: Official BGG Data and Search

**Design rules**: [docs/design.md](../../docs/design.md) v2.4.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Agreed**: 2026-11-05

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
starting point in the black bar ("Start"). BoardGameGeek is a stand-in (no network); covers are
generated. The alternatives shown during the review are removed; the prototype shows the agreed
choices only.

## Where the feature lives

- **Search** place (menu): search field, results, game info sheet, add to collections sheet.
- **Collection**: the Add game sheet searches by name as well.
- User story 2 (official data) changes nothing visible.

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Search** | heading "Search"; label "Search BoardGameGeek"; search field ("Game name, e.g. Cascadia", clear ×); hint "Type at least 2 letters."; separator; status line ("6 games · exact matches first"); result rows. **No action bar** | — |
| ↳ typing | search 0.5 s after the last key (Enter: at once); first search: 4 placeholder rows; later: old results dimmed until the new ones arrive; an older answer arriving late is dropped | — |
| ↳ result row | cover (initials until covers arrive), name, year or "Year unknown", **Expansion** pill, teal "in Essen 2026" / "in 2 collections"; a **big +** at the right | row: Game info sheet; +: Add to collections sheet |
| ↳ 50 results | status "50 games · the first 50, exact matches first"; below the list "More games match. Type more of the name to narrow it down." | — |
| ↳ no match | empty state "No game called “…” on BoardGameGeek", "Check the spelling, or try a shorter part of the name." | — |
| ↳ BGG asks to wait | status "BoardGameGeek asks us to wait a moment… still searching" (no error) | results |
| ↳ offline / not reachable | framed red note "You're offline. Searching needs a connection." / "BoardGameGeek is not reachable. Try again in a moment." + **Try again** | — |
| ↳ no token on the server | today's "comes soon" card and disabled field, no action bar | — |
| **Game info sheet** | name; cover (→ image viewer), "2021 · Kosmos", Open on BoardGameGeek; description; info box (Players, Rating, Geek rating, Designers, Mechanisms, Publisher; "From BoardGameGeek"); **Close**. No collections, category or adding actions | — |
| **Add to collections sheet** | "Add <game>"; Found game card; collection ticks with notes (starting from where the game is now); "Category when added (optional)" honeycomb; **Done** / Cancel | toast "Added Cascadia to 1 collection"; the row's "in …" line updates |
| **Add game sheet** (collection) | one field "Game name or BoardGameGeek link"; a name shows up to 8 compact matches (no +); a link is recognised as before; picking shows the **Found game** card (Change) and the editable name; "already in <collection>" disables the action; Category (optional); Cancel / **Add to collection** | toast "Added <game> to <collection>" |

## Components used

From [docs/design.md](../../docs/design.md) v2.4.0: **Search BoardGameGeek**, **Search result row**,
**Game info sheet**, **Add to collections sheet** (new), **Add game** (changed: one field for name or
link), Action bar and Main button (changed: none on Search), Multi-choice list, Category picker,
Game info, Image viewer, Empty state, Sheet, Toast, Separator.

## Decisions from the review (2026-11-05)

- Search has **no main button or action bar**: the search field at the top is the only search control.
- No hint about what can be found; only "Type at least 2 letters." under the field.
- Each result has a **big +** that adds the game to collections; **tapping a game only shows its
  info** (alternative: one details sheet with info and collection ticks, not chosen).
- The game info sheet has no "Add booth or price" link (no adding actions).
- Add game uses **one field** for name or link (alternative: a Name | Link switch, not chosen).
- Results sort exact matches first, then names starting with the text, then the rest; within each, the shorter name first (closer match), then alphabetical. Changed after the review
  (research R5): search answers carry no ratings, and fetching them first would slow every search; the
  prototype's geek-rating order is not built.
