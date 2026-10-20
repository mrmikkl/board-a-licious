# Feature design: Big Game Images, BGG Gallery and Show-off

**Design rules**: [docs/design.md](../../docs/design.md) v2.1.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Agreed**: 2026-10-20

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
starting point in the black bar ("Start"). Game images are generated stand-ins, not BGG images.
The "Comb" and "Button" pickers show alternatives; the agreed ones are **A** (three per row, every
other row shifted) and Show-off at the **right** edge.

## Where the feature lives

- **Image viewer**: over a game's details sheet (in a collection and in a BGG list) and over the
  Show-off screen.
- **Show-off**: a fourth action in a collection's action bar → the Show-off sheet → the Show-off
  screen (one level deep, back to the collection).

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Game details** (existing sheet) | the cover carries a small ⤢ badge and is a button "Show the images of <game> big" | the image viewer |
| **Image viewer** (full screen) | name, "3 / 24", ✕; the image fitted; hexagon dots, caption "<kind> · from BoardGameGeek"; on pointer devices ‹ › | swipe ←/→: next/previous image (springs back at the ends); swipe down, ✕, Back, Esc: back where it was opened |
| ↳ offline / no gallery / details pending | the best image on the phone (or the initials hexagon), one muted line why there are no more images; no dots, no position | as above |
| **Collection** action bar | Add game · ♥ · Filter · **Show-off** | Show-off sheet |
| **Show-off** (sheet) | "Which groups do you want to show?", six groups with emoji, label, count and a hexagon tick; Cancel / **Show off** (disabled while none chosen); last choice preselected (first time Must Have) | the Show-off screen |
| **Show-off** (screen) | ‹ back, heading "Show-off", "Essen 2026 · ⭐ 👀 · 8 games", the honeycomb of covers (✓ on bought games) | tap a hexagon: the image viewer; ‹: the collection |
| ↳ no game in the chosen groups | empty state "No game in these groups", **Choose groups** | the Show-off sheet |

## Components used

From [docs/design.md](../../docs/design.md): **Image viewer** and **Show-off** (new in v2.1.0),
Action bar (fourth action at the outer right), Sheet, Multi-choice list, Screen heading with back,
Empty state, hexagon covers with the bought badge, Toast.

## Decisions from the review (2026-10-20)

- Honeycomb: **three per row, every other row shifted** by half a hexagon (alternative "3 / 2 / 3,
  centred" not chosen).
- Show-off sits at the **outer right** of the action bar, after Filter.
- Gallery swipes **spring back** at the first and last image, with resistance while dragging past.
- A step in the gallery **slides in place**; nothing of the screen behind may flash (the prototype's
  first version re-rendered the viewer and flickered).
- Choosing groups in the Show-off sheet updates the ticks in place (no sheet slide replay).
