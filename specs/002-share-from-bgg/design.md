# Feature design: Share from BGG into the App

**Design rules**: [docs/design.md](../../docs/design.md) v1.9.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Agreed**: 2026-10-19

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
scenario at the top. Every scenario starts outside the app on a BoardGameGeek page (a plain
stand-in, not part of the app) and its Android share menu; tapping **board-a-licious** there opens
the app. The app part uses the app's own theme CSS and sample data.

## Where the feature lives

- **Outside the app**: the BGG app or boardgamegeek.com in Chrome → Share → **board-a-licious** in
  the phone's share menu. The app only appears there once it is installed to the home screen.
- **Inside the app**: the share opens the app on the collection shared into last, with the sheet
  below on top. No new tab, no new screen.

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Add game (shared)** (sheet, over the collection shared into last) | hexagon cover, editable name, "Shared from BoardGameGeek"; collection dropdown, last used preselected and marked "(last used)", collections holding the game marked "(already in it)"; one hint line; Cancel / **Add to collection** | the chosen collection with the new row highlighted, toast "Added Cascadia to Essen 2026" |
| ↳ already in the chosen collection | red hint "Cascadia is already in Essen 2026. Pick another collection."; Add to collection disabled until another collection is chosen | as above |
| ↳ offline | framed note: the game is added on this phone now, cover and details follow once online; the new row shows "Details follow from BoardGameGeek" | as above |
| ↳ no collection yet (sheet over the empty collections screen) | cover and name, one line explaining a collection is needed, collection name prefilled "SPIEL 2026", Cancel / **Create and add** | the new collection with the game in it |
| **Not a BoardGameGeek game** (sheet) | one line why nothing can be added, the shared link, Close / **Add game by link** | Close: the collection behind; Add game by link: the "Add game" sheet with an empty link |
| Shared BGG list (preview or geeklist) | no sheet: the list opens and starts loading, as when loaded by link | the list |
| **Config** (only while not on the home screen) | card "📲 Share from BoardGameGeek" at the top: install to the home screen (Chrome menu ⋮ → Add to Home screen), then share from BGG | — |

## Components used

From [docs/design.md](../../docs/design.md): Sheet, **Shared game** (new), **Choosing a collection**
(new: dropdown), Inputs (field and dropdown look), Game row with the **Just added** highlight (new
motion rule), Toast, Empty state, **Share hint** (new), Primary and secondary buttons.

## Decisions from the review (2026-10-19)

- The collection is chosen with a **dropdown**, not with cards: cards grow far too long with many
  collections (the local test data has over a thousand).
- Changing the dropdown updates only the hint and the button; the sheet does not slide up again
  (now a general motion rule for sheets).
- The prototype stays a single HTML file; no prototype code inside the app.
- Kept from the spec: shared games start as Not yet marked; the name stays editable.
