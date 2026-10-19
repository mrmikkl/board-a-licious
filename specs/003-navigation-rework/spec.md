# Feature Specification: Navigation Rework with a Context-Aware Main Button

**Feature Branch**: `003-navigation-rework`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Navigation and actions rework (context-aware main button). (1) Inside a
collection, the "Not yet marked" group can be collapsed and expanded like the other groups and sits
above "Not interested". (2) New top bar on every screen: app logo top left, "board-a-licious"
centred, a menu button (three lines) top right, set apart as its own band (e.g. orange heading);
below it the heading of the current screen. The menu holds the navigation: Collections, BGG lists,
Search, Config. (3) The bottom navigation bar (Collections, Lists, big orange plus, Search, Config)
is replaced by a bottom action area holding only the big orange main button plus the current
screen's actions; the main button changes with the screen: Collections → plus, creates a collection
(the current "Create a collection" entry is removed); inside a collection → heart, picks a BGG list
then opens the swipe (Tinder) mode, replacing the top button that does this today; the collection's
actions currently at the top move down next to the main button; Lists → plus, opens a bottom sheet to
load a BGG list by link (the current "Load a BGG list" entry is removed); Search → magnifying glass,
disabled for now; Config → no bottom area at all. (4) The current plus menu (Collection, BGG list,
Game) is removed. Adding a single game moves into the collection: its link icon becomes a plus. (5)
No top button is highlighted as primary (orange) any more."

Product context: [docs/vision.md](../../docs/vision.md). Changes the navigation and screen layout of
feature [001](../001-bgg-game-collection/spec.md) (collections, BGG lists, add by list/swipe, add
game by link) and keeps feature [002](../002-share-from-bgg/spec.md) (share from BGG) working. Look
and feel: [docs/design.md](../../docs/design.md), which this feature amends (navigation, header,
tab bar).

**Goal**: the screen is for content; navigation lives in one menu at the top, and the bottom holds
only what you can do on the current screen, led by one big main button whose meaning follows the
screen. This frees room at the top and makes adding new screens later (via the menu) easy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Navigate with the app bar and its menu (Priority: P1)

On every screen the user sees the same app bar at the top: the app logo on the left, the name
"board-a-licious" in the middle and a menu button (three lines) on the right, set apart as its own
band. Below it is the heading of the current screen (e.g. "Collections", a collection's name). Tapping
the menu button opens the menu with Collections, BGG lists, Search and Config; tapping an entry goes
there and closes the menu. The bottom navigation bar is gone.

**Why this priority**: Removing the bottom navigation is only possible once the menu works; every
other story relies on it.

**Independent Test**: Open the app, open the menu, go to each of the four places and back to
Collections; no bottom navigation bar is visible anywhere.

**Acceptance Scenarios**:

1. **Given** any screen, **When** the user looks at the top, **Then** they see the logo (left), "board-a-licious" (centre) and the menu button (right) in a band set apart from the content, and below it the current screen's heading.
2. **Given** the menu is closed, **When** the user taps the menu button, **Then** a menu opens listing Collections, BGG lists, Search and Config, with the current place marked.
3. **Given** the menu is open, **When** the user taps "BGG lists", **Then** the BGG lists screen opens and the menu closes.
4. **Given** the menu is open, **When** the user taps outside it, presses Back or Escape, **Then** the menu closes and the screen stays as it was.
5. **Given** a screen one level deep (a collection, a BGG list, Share and backup, swipe mode), **When** the user looks at the screen heading, **Then** a back button next to it leads one level up.
6. **Given** any screen, **When** the user looks at the bottom, **Then** there is no navigation bar with Collections, Lists, Search and Config.

---

### User Story 2 - A main button that follows the screen (Priority: P1)

At the bottom there is only an action area: the big orange main button and, on some screens, that
screen's own actions next to it. The main button changes with the screen:

| Screen | Main button | Tapping it |
|---|---|---|
| Collections | plus | creates a collection (name the new collection, then it opens) |
| A collection | heart | asks which BGG list, then opens the swipe mode for that list into this collection |
| BGG lists | plus | opens a sheet from the bottom to load a BGG list by its link |
| Search | magnifying glass | nothing yet: shown disabled |
| Config | — | no bottom area at all |

The old plus menu (Collection / BGG list / Game) and the entries that duplicated these actions
("Create a collection" on Collections, "Load a BGG list" on BGG lists, "Add by list" at the top of a
collection) are removed.

**Why this priority**: This is the core of the rework: one obvious action per screen, in reach of the
thumb.

**Independent Test**: On Collections tap the plus and create "Test"; it opens. Tap the heart, pick a
loaded BGG list, swipe one game right; it is in "Test". Go to BGG lists, tap the plus, paste a list
link; the list opens. On Search the magnifying glass is disabled; Config has no bottom area.

**Acceptance Scenarios**:

1. **Given** the Collections screen, **When** the user taps the main button (plus), **Then** a form to name a new collection opens, and creating it opens the new collection.
2. **Given** the Collections screen, **When** the user looks at the content, **Then** there is no separate "Create a collection" entry; with no collections yet, the empty screen points to the main button.
3. **Given** a collection, **When** the user taps the main button (heart), **Then** the BGG list choice opens, and picking a list opens the swipe mode for that list into this collection (as "Add by list" does today).
4. **Given** a collection and no BGG list loaded yet, **When** the user taps the heart, **Then** the choice says so and offers loading a BGG list by link (as today).
5. **Given** the BGG lists screen, **When** the user taps the main button (plus), **Then** a sheet slides up from the bottom with a field for a BoardGameGeek preview or geeklist link; a valid link opens that list and starts loading it, an invalid one shows the existing hint.
6. **Given** the BGG lists screen, **When** the user looks at the content, **Then** there is no separate "Load a BGG list" entry; with no lists yet, the empty screen points to the main button.
7. **Given** the Search screen, **When** the user looks at the main button, **Then** it shows a magnifying glass, is visibly disabled and does nothing when tapped.
8. **Given** the Config screen, **When** the user looks at the bottom, **Then** there is no main button and no action area; the content uses the full height.
9. **Given** any place in the app that used to lead to the plus menu (e.g. links in empty states, Share and backup, a failed list), **When** the user taps it, **Then** it leads to the matching action directly (create a collection, load a BGG list).
10. **Given** any screen, **When** the user looks at the buttons at the top, **Then** none of them is highlighted orange as primary; orange is reserved for the main button.

---

### User Story 3 - A collection's actions at the bottom (Priority: P2)

Inside a collection, the actions that today sit in a row at the top (add a game, filter and group,
the collection's ⋯ options) move into the bottom action area next to the heart. Adding a single game
shows a plus instead of the link icon. The top of the collection shows only the heading and the
content starts right below it.

**Why this priority**: Gains room at the top and keeps all actions in one place, but the collection
works without it (P1 already moved "Add by list" to the heart).

**Independent Test**: Open a collection with games: at the bottom are the heart and next to it add
game (plus), filter and group, and options (⋯); at the top only the app bar and the collection's
name. Each of them opens the same sheet as before.

**Acceptance Scenarios**:

1. **Given** a collection with games, **When** the user looks at the bottom, **Then** the heart main button is there with add game (plus), filter and group, and options next to it.
2. **Given** a collection, **When** the user taps the plus next to the heart, **Then** the "Add game" sheet opens (add a single game by its BoardGameGeek link) as today.
3. **Given** a collection with an active filter or grouping, **When** the user looks at the filter action, **Then** it shows that it is active (as today), and the summary of what is shown stays above the games.
4. **Given** an empty collection, **When** the user looks at the screen, **Then** the empty state explains the heart (go through a BGG list) and the plus (add a single game) and the same bottom actions are there.
5. **Given** a collection, **When** the user looks at the top, **Then** there is no tool row with Add by list, Add game, filter and options any more.

---

### User Story 4 - "Not yet marked" folds and sits above "Not interested" (Priority: P2)

In a collection grouped by mark, the group "Not yet marked" comes after Poop and directly above
"Not interested" instead of first, and it can be collapsed and expanded by tapping its heading, like
"Not interested".

**Why this priority**: Puts the games the user already cares about at the top; small and
independent.

**Independent Test**: Open a collection with games in all marks: the groups are Must Have,
Interested, Unsure, Poop, Not yet marked, Not interested; tapping "Not yet marked" hides its games,
tapping again shows them.

**Acceptance Scenarios**:

1. **Given** a collection grouped by mark, **When** the user looks at the groups, **Then** the order is Must Have, Interested, Unsure, Poop, Not yet marked, Not interested (empty groups left out as today).
2. **Given** the "Not yet marked" group is expanded, **When** the user taps its heading, **Then** its games are hidden and the heading still shows the count; tapping again shows them.
3. **Given** the user opens a collection, **When** the screen appears, **Then** "Not yet marked" is expanded and "Not interested" is collapsed (as today).
4. **Given** the mark picker on a game, the swipe mode and the shared lists, **When** marks are listed there, **Then** their order is unchanged (only the group order in a collection changes).

### Edge Cases

- **Screens without a main button of their own** (a single BGG list, swipe mode, Share and backup,
  a shared game): they show no main button; swipe mode keeps its own swipe buttons at the bottom.
- **A sheet is open** (add game, filter, list choice, load a list): the sheet covers the action area;
  closing it shows the action area again.
- **The keyboard is open** (typing a link or a collection name): the action area does not float over
  the field being typed into.
- **Menu open while offline**: navigation works offline as today; nothing in the menu needs the
  network.
- **Old bookmarks or installed shortcuts to the plus menu** (`Add`): open the Collections screen
  instead of an empty page.
- **Sharing from BGG (feature 002)** still opens the shared-game sheet over the collection; the sheet
  covers the action area.
- **Toasts** appear above the action area (or at the bottom on Config), never under the main button.
- **Wide screens** (tablet, laptop): the app bar spans the column; the action area stays phone-sized
  and centred, as the tab bar does today.
- **Reduced motion**: the menu and the load-a-list sheet appear without sliding.

## Requirements *(mandatory)*

### Functional Requirements

**App bar and menu**

- **FR-001**: Every screen MUST show the app bar at the top: app logo on the left, the name
  "board-a-licious" centred, a menu button (three lines) on the right, visually set apart from the
  content as its own band.
- **FR-002**: Below the app bar every screen MUST show its heading (the screen name or the
  collection's or list's name), with a back button on screens one level deep.
- **FR-003**: The menu button MUST open a menu listing Collections, BGG lists, Search and Config,
  marking the current place; choosing an entry MUST go there and close the menu; tapping outside,
  Back or Escape MUST close it without navigating.
- **FR-004**: The bottom navigation bar (Collections, Lists, plus, Search, Config) MUST be removed.
- **FR-005**: The menu MUST be built so that further entries can be added later without changing the
  screens.

**Main button and action area**

- **FR-006**: The bottom MUST hold only an action area: the big orange main button and, where
  defined, the current screen's own actions next to it.
- **FR-007**: On Collections the main button MUST show a plus and create a collection; the "Create a
  collection" entry on the screen MUST be removed.
- **FR-008**: Inside a collection the main button MUST show a heart and start adding by list (choose
  a BGG list, then the swipe mode into this collection); the separate "Add by list" button MUST be
  removed.
- **FR-009**: On BGG lists the main button MUST show a plus and open a bottom sheet to load a
  BoardGameGeek preview or geeklist by its link, with the same link checks and hints as today; the
  "Load a BGG list" entry on the screen MUST be removed.
- **FR-010**: On Search the main button MUST show a magnifying glass and be disabled (announced as
  unavailable to screen readers).
- **FR-011**: On Config there MUST be no action area and no main button.
- **FR-012**: Screens not listed in FR-007 to FR-011 (a single BGG list, swipe mode, Share and
  backup, a shared game) MUST NOT show a main button; swipe mode keeps its swipe buttons.
- **FR-013**: The plus menu (Collection / BGG list / Game) MUST be removed; every link that led to it
  MUST lead directly to the matching action, and an old address of it MUST open Collections.
- **FR-014**: The main button MUST have an accessible name that says what it does on that screen
  (e.g. "Create a collection", "Add by list", "Load a BGG list", "Search (not available yet)").

**Collection screen**

- **FR-015**: Inside a collection, add game, filter and group, and the collection's options MUST be
  in the action area next to the heart, not at the top; add game MUST show a plus instead of the link
  icon.
- **FR-016**: The filter action MUST show when a filter or grouping is active; the summary of what is
  shown MUST stay above the games.
- **FR-017**: When grouped by mark, the groups MUST be ordered Must Have, Interested, Unsure, Poop,
  Not yet marked, Not interested; the order of marks elsewhere MUST stay unchanged.
- **FR-018**: The "Not yet marked" group MUST collapse and expand by tapping its heading, showing its
  count while collapsed; it MUST be expanded when the collection opens.

**Look**

- **FR-019**: No button at the top of any screen MUST be highlighted orange as primary; the orange
  primary look is reserved for the main button (and for primary actions inside sheets and empty
  states, as today).
- **FR-020**: The app bar, menu, action area and main button MUST meet the existing accessibility
  rules (touch targets, contrast, keyboard and screen-reader use) and the motion rules (reduced
  motion respected).

### Key Entities

- **Screen action set**: for each screen, which main button it shows (icon, label, what it does,
  enabled or disabled, or none) and which other actions sit next to it.
- **Menu entry**: a place in the app (label, icon, destination) shown in the menu; today Collections,
  BGG lists, Search, Config.

No stored data changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From any screen, every one of the four places (Collections, BGG lists, Search, Config)
  is reachable in 2 taps (menu, entry).
- **SC-002**: Starting a swipe session into the current collection takes 2 taps (heart, list), both within
  thumb reach at the bottom of the screen.
- **SC-003**: On a phone (360×740), a collection with games shows at least one more game row on
  screen than before, because the tool row at the top is gone.
- **SC-004**: Every screen shows at most one orange main button and no orange button at the top.
- **SC-005**: All existing journeys of features 001 and 002 (create a collection, add by list, add a
  game by link, load a BGG list, share and backup, share from BGG) still complete, now through the
  menu and the main button.
- **SC-006**: The accessibility check finds no new violations on any screen.

## Assumptions

- The menu opens as a panel from the top right (exact look decided in the design step); it holds
  only navigation, no actions.
- "Above Not interested" means directly above it, i.e. "Not yet marked" moves from first to second
  last; only the grouping in a collection changes, not the mark order in pickers or shared text.
- Whether "Not yet marked" was collapsed is not remembered between visits (like "Not interested"
  today).
- The collection's ⋯ options (rename, delete, share) stay as they are, only their button moves to the
  bottom.
- Creating a collection from the plus uses the existing new-collection form (its name) in a sheet.
- Search stays a placeholder screen; the disabled magnifying glass becomes active with a later search
  feature.
- On wide screens the action area stays phone-sized and centred, as the tab bar does today.
- Share and backup stays reachable from Config as today.
