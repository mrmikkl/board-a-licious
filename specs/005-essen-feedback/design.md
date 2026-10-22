# Feature design: Essen Feedback

**Design rules**: [docs/design.md](../../docs/design.md) v2.2.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Agreed**: 2026-10-22

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
starting point in the black bar ("Start"). Covers are generated stand-ins. The alternatives shown
during the review are removed; the prototype shows the agreed choices only.

## Where the feature lives

- **Collection screen**: game rows (category border, Buy and Category actions), quick filters,
  search, Filter and group sheet, Category sheet, Buy sheet.
- **Game details** (sheet): category picker above the info box, ratings in the info box.
- **A single BGG list**: Resync icon in the heading, conflicts sheet.

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Collection** | heading + pencil; bought line; separator; quick filters (**Cat \| Booth**, **🛒 Buy**, "14 games"); separator; search field; groups of game rows; action bar Add game · ♥ · Filter · Show-off | — |
| ↳ game row | whole 1px border in the category's gradient; cover, name, publisher, infos (booth view: booth or "Hall 3, booth unknown"); at the right **Buy** and **Category** | row: Game details; Buy: Buy sheet (or not bought at once); Category: Category sheet |
| ↳ group heading | every group (category, hall, No booth yet) folds and unfolds with a tap; Not interested starts folded | — |
| ↳ Cat \| Booth | groups by categories or by halls (the same as "Group by") | — |
| ↳ 🛒 Buy | only not-bought Must Have, Interested, Unsure; Filter action highlighted | off: the filter before |
| ↳ search | narrows by name as you type; no match: "No game called “…” here." + Clear the search | — |
| **Buy sheet** | "Bought <game>?", price + currency, Cancel / **Got it** | the collection, toast "<game>: got it for €24!" |
| **Category sheet** | "Category of <game>", Must Have … Poop, line, No category yet, Not interested; current marked | the collection, toast "<game> → ⭐ Must Have"; the row moves to its group |
| **Filter and group** (sheet) | Bought, Price, Categories (with counts, Select all / none), Group by (Categories / Booths); Clear filters / **Done** | the collection |
| **Game details** (sheet) | name; cover, publisher · year, bought pill, Open on BoardGameGeek; **category picker** (honeycomb 3 + 2); "🛑 Not interested"; info box with Price, Players, **Rating**, **Geek rating**, Booth, …; Bought it / Not bought after all; Remove | picker changes in place; Bought it: Buy sheet |
| **BGG list** | ‹ back, list title, **Resync** icon; status line and progress; filter field; rows | Resync: progress in the status line, toast, then the conflicts sheet if any |
| **Conflicts** (sheet) | "3 conflicts", one-line explanation; **Use BGG for all** / **Use own for all**; per conflict game, "<field> · in <collection>", Own / BGG tiles; Later / **Apply** | the list, toast "2 values taken from BGG" |

## Components used

From [docs/design.md](../../docs/design.md) v2.2.0: **Game row** (changed), **Quick filters**,
**Search in a collection**, **Category sheet**, **Buy sheet**, **Category picker**, **Resync and
conflicts** (new), **Filter and group** (changed: Clear filters, Categories / Booths, no summary
line), Game info (ratings), Sheet, Toast, Separator, Screen heading, Action bar.

## Decisions from the review (2026-10-22)

- The game row's **whole border** shows the category's colour, at the **same 1px width** as before
  (alternative: a coloured left edge, not chosen).
- The Category action uses a **neutral icon** (two hexagons), not the current category's emoji, so
  the right side holds actions only.
- The Category sheet is a **list** of categories (alternative: hexagons, not chosen).
- The category picker in the details is a **honeycomb, three on top and two below** (alternative:
  a flat-top zigzag in one row, not chosen).
- **For later** is ⏳ with a **pink** gradient (`#D946EF` → `#F9A8D4`, dark text).
- **Resync** is an **icon button in the list's heading** (alternative: a button above the list).
- **Every group folds** (not only No category yet and Not interested), added after the review.
- The Buy action shows the price paid as its label once bought; the row's info line no longer
  repeats it.
