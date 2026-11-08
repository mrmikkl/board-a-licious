# Design: List Filter

**Status**: Draft for review (2026-11-08) | **Prototype**: [design/prototype.html](design/prototype.html)
| **Rules**: [docs/design.md](../../docs/design.md) v3.2.0 (binding)

## Screens

- **BGG list** (status list, preview, geeklist): the name field stays; the action bar gets the
  **Filter** action at the left (icon and label orange while a filter is set, as in shopping lists).
  Own status lists keep their main button ＋ (Add a game to <status>); previews, geeklists and
  friends' lists have no main button. With a filter or a name typed, a count line under the field:
  "**12** of 80 games" and, with a filter, **Clear filters**.
- **Filter sheet** ("Filter"; in shopping lists "Filter and group" with the existing sections first
  and a small heading "About the game" before the new ones). Sections, each with a short muted note
  after its title:
  - **Length** "any ticked one": four chips "Short · 0–30 min", "Middle · 31–60 min",
    "Long · 61–120 min", "Very long · 121+ min", each with its count; ticked chips are filled hot.
    A muted line names games without a length.
  - **Players** "BGG's player poll": segment Any | Best for | Recommended; with Best for or
    Recommended, number chips 1 … the largest count in the list's polls (at least 6), one chosen
    (default 3), and a muted line "7 games best for 2" / "… recommended for 3 (best counts too)".
  - **Rating** "BGG average" and **Geek rating**: from – to dropdowns (0.0, 5.0, 5.5 … 9.0, 10.0);
    0–10 does not filter. A muted line names games without a rating.
  - **Mechanisms** and **Designers** "every ticked one": checkbox rows with counts, the 8 most common
    first, "Show all (n)"; above 8 values a find field narrows the rows. Ticked values no longer in
    the list stay with count 0.
  - **Clear filters** (disabled at the default) and **Done · n games**.
- **Reading details**: while missing details are read, a framed line at the top of the sheet with the
  spinning hexagon: "Reading game details from BoardGameGeek… **12 of 16**"; sections and counts grow
  as details arrive; the list behind updates. Offline or BGG failing: a red-bordered line
  "<n> games are left out: their details need a connection." with Try again.
- **Config › Game length**: hint, four rows (name, range text, the minute field where it ends;
  Very long without a field), an error line "Each length must end after the one before.", Reset
  (disabled at 30 / 60 / 120) and **Save game length**.

## Decisions taken in the prototype

- Chips for Length (multi-choice) and the player count (one choice) instead of segments: four or six
  options with counts do not fit one segment row at 360 px.
- The sheet's Done names the result count, so the person sees the effect without closing it.
- No new main button: Filter is a screen action like in shopping lists.
- **Main button label** (owner, 2026-11-08): every main button carries a short label **inside the
  hexagon**, under its icon (Manrope 10px extra bold, dark text; the hexagon grows to 68×76 px and the
  icon shrinks to 24 px): **Tinder** (shopping list ♥), **New list**
  (Buy › Shopping lists ＋), **Load list** (Lists ＋), **Add game** (own status list ＋). The
  accessible name stays the full sentence ("BG-Tinder: swipe a BGG list into this shopping list").
  Applies app-wide (docs/design.md "Main button").
