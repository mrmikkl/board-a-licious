# Feature design: Navigation Rework with a Context-Aware Main Button

**Design rules**: [docs/design.md](../../docs/design.md) v2.0.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Icons**: [design/icons/](design/icons/) | **Agreed**: 2026-10-20

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
starting screen in the black bar at the top ("Start on"). The "App bar" picker shows the dark
alternative that was not chosen; the agreed look is **A · orange band**. The prototype uses the
app's own theme CSS and sample data.

## Where the feature lives

Every screen: the app bar on top, the action bar at the bottom. The screens' content stays as in
features 001 and 002 except where listed below.

## Screens and flows

| Screen | Heading | Action bar (left · main · right) | Leads to |
|---|---|---|---|
| **Every screen** | app bar: logo · "Board-a-licious" · ☰ | — | ☰ → **Menu**: Collections, BGG lists, Search, Config |
| **Collections** | "Collections" | · ＋ · | ＋ → **New collection** sheet → the new collection |
| ↳ no collections yet | "Collections" | · ＋ · | empty state "No collections yet": "Tap + below to create your first one" |
| **Collection** | name + ✏️ (no back) | Add game (＋) · ♥ · Filter | ♥ → **❤️ BG-Tinder ❤️** sheet → Swipe; Add game → Add game sheet; Filter → Filter and group sheet; ✏️ → **Edit collection** |
| ↳ groups | | | Must Have, Interested, Unsure, Poop, separator, Not yet marked (folds, open), Not interested (folds, closed) |
| ↳ long name | name runs as a **ticker**, ✏️ at the right edge | | |
| ↳ empty collection | name + ✏️ | Add game · ♥ · Filter | empty state explains the heart (swipe a BGG list) and Add game (a single game by link) |
| **BGG lists** | "BGG lists" | · ＋ · | ＋ → **Load a BGG list** sheet → the list, loading |
| ↳ no list yet | "BGG lists" | · ＋ · | empty state: "Tap + below and paste the link…" with the SPIEL preview as example |
| **A BGG list** | ‹ list title | none | unchanged |
| **Swipe** | ‹ "Add to <collection>" | none (its ✕ / ✓ buttons and swiping stay) | unchanged |
| **Search** | "Search" | · 🔍 (disabled) · | nothing yet |
| **Config** | "Config" | none | Share and backup (‹ back to Config) |
| **Shared game** (002) | sheet over the collection | covered by the sheet | unchanged |

Removed: the tab bar, the + add choice screen (old links open Collections), the "Create a
collection" card, the "Load a BGG list" card and button, the collection's tool row (Add by list,
Add game, Filter, ⋯) and its options sheet (now Edit collection), the collection's back button.

## Components used

From [docs/design.md](../../docs/design.md): **App bar**, **Menu**, **Action bar**, **Main
button**, **New collection**, **Load a BGG list**, **Edit collection**, **Ticker**, **App icon**
(all new in v2.0.0); **BG-Tinder** (renamed from Add by list), Group heading (Not yet marked now
folds), Separator (also between marked and unmarked groups), Add game, Filter and group, Sheet,
Empty state, Toast, Card.

## Decisions from the review (2026-10-20)

- App bar: **orange band** (hot gradient), slim (~48px), name written **"Board-a-licious"**; the
  dark band with an orange name was the alternative.
- Logo and home-screen icon: **`hex-gradient-colour.png`** from the Board-a-licious icon set
  (copied to `design/icons/`); the full badge with lettering and the glyph were compared and not
  chosen for the bar.
- Collection: no back button; editing moves from ⋯ to a **pencil after the name**; ⋯ is gone; the
  action bar is **Add game · ♥ · Filter** (balanced around the heart).
- A long collection name **runs like a ticker** (about 50px/s, pause at both ends, loop) instead of
  wrapping or ending in "…".
- The heart's sheet is titled **"❤️ BG-Tinder ❤️"**; Swipe itself is unchanged (swiping and its ✕ / ✓
  buttons stay).
- A **separator** splits the marked groups from Not yet marked and Not interested.
