# Feature Specification: Big Game Images, BGG Gallery and Show-off

**Feature Branch**: `004-show-off-gallery`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Big game images, BGG image gallery and a "Show-off" view. (1) In a
game's details sheet (e.g. tapping a game in a collection), tapping its cover opens the image big
(full-screen viewer). In the viewer the user can swipe left/right through the game's BoardGameGeek
image gallery (if available). An X closes the viewer, and swiping down closes it too. (2) In a
collection, a new action "Show-off" in the bottom action bar opens a sheet (like the other bottom
actions) where the user selects groups (Must Have, Interested, Unsure, Poop, Not yet marked, Not
interested; several at once). Confirming shows a screen with the covers of the games in the
selected groups as hexagons, tightly packed in a honeycomb (rows shifted so the hexagons fit
together), about three per row and as many rows as needed. Tapping a hexagon opens the same big
image viewer with the gallery, swipe left/right, X and swipe down to close."

Product context: [docs/vision.md](../../docs/vision.md). Builds on features
[001](../001-bgg-game-collection/spec.md) (collections, marks, game details completed from
BoardGameGeek, offline) and [003](../003-navigation-rework/spec.md) (action bar, sheets opened from
the bottom). Look and feel: [docs/design.md](../../docs/design.md) v2.0.0.

**Goal**: games are chosen by how they look as much as by their facts. Seeing a box big, flipping
through BGG's photos of the components, and showing friends a wall of the games you want should
take one or two taps.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a game's image big and swipe through its gallery (Priority: P1)

In a collection the user taps a game, the details sheet opens, and they tap the cover. The image
opens full screen in high quality. Swiping left and right moves through the game's BoardGameGeek
image gallery (box, components, play photos). A position shows where they are (e.g. "3 / 24"). An
X closes the viewer; swiping down closes it too, back to the details sheet.

**Why this priority**: it is the building block of the whole feature (Show-off opens the same
viewer) and is useful on its own in every collection and BGG list.

**Independent Test**: open a game with a BoardGameGeek page in a collection, tap the cover: the big
image shows; swipe left twice: the third gallery image shows with "3 / n"; swipe down: back in
the details sheet.

**Acceptance Scenarios**:

1. **Given** a game's details sheet with a cover, **When** the user taps the cover, **Then** a full-screen viewer opens with the game's main image in a large size and the game's name.
2. **Given** the viewer is open and BoardGameGeek has more images of the game, **When** the user swipes left (or right), **Then** the next (or previous) image shows and the position updates ("2 / 24").
3. **Given** the viewer is open, **When** the user taps X, presses Back or Escape, or swipes down, **Then** the viewer closes and the details sheet is shown as before.
4. **Given** the viewer shows the first image, **When** the user swipes right, **Then** the image resists and springs back fully into view (no wrap-around); likewise at the last image.
5. **Given** a game whose gallery has only its main image (or the gallery cannot be loaded), **When** the viewer opens, **Then** the main image shows without a position and without swiping; a gallery that fails to load says so in one short line without hiding the image.
6. **Given** a game in a BGG list's game sheet, **When** the user taps its cover, **Then** the same viewer opens.
7. **Given** a keyboard or a screen reader, **When** the viewer is open, **Then** arrow keys move between images, Escape closes, and every image has the game's name and its position as text alternative.

---

### User Story 2 - Show-off: a honeycomb of the games you picked (Priority: P2)

In a collection the user taps the new **Show-off** action in the bottom bar. A sheet asks which
groups to show (Must Have, Interested, Unsure, Poop, Not yet marked, Not interested; any number of
them). Confirming opens the Show-off screen: the covers of the games in those groups as hexagons,
packed edge to edge like a honeycomb, three across with every other row shifted, as many rows as
needed. Tapping a hexagon opens the big image viewer with that game's gallery.

**Why this priority**: the fun "look at my list" moment for showing friends at the fair; it reuses
the viewer of US1.

**Independent Test**: in a collection with Must Have and Interested games, tap Show-off, keep only
Must Have, confirm: only the Must Have covers show as a honeycomb; tap one: its big image and
gallery open; close: back on the honeycomb.

**Acceptance Scenarios**:

1. **Given** a collection with games, **When** the user looks at the action bar, **Then** there is a Show-off action beside the existing ones.
2. **Given** the user taps Show-off, **When** the sheet opens, **Then** it lists the six groups with their marks and counts, each selectable, the groups chosen last time in this collection (first time: Must Have) preselected, and an action to show them (disabled while nothing is selected).
3. **Given** groups are selected, **When** the user confirms, **Then** the Show-off screen shows one hexagon per game of those groups, in mark order and by name within a mark, three hexagons in the first row, the next row shifted by half a hexagon so they interlock, and so on.
4. **Given** the Show-off screen, **When** the user taps a hexagon, **Then** the big image viewer opens on that game (as in US1).
5. **Given** the Show-off screen, **When** the user looks at a hexagon, **Then** it shows the game's cover filling the hexagon (or the game's initials when there is no cover yet) and, for bought games, the bought tick; the game's name is available to screen readers and on long press or focus.
6. **Given** the Show-off screen, **When** the user wants to leave, **Then** a back button returns to the collection, and the heading names the collection and the chosen groups (e.g. "Essen 2026 · ⭐ 👀").
7. **Given** selected groups with no games, **When** the user confirms, **Then** the screen says no game matches and offers to choose other groups.

### Edge Cases

- **Offline**: the big viewer shows the largest image already on the phone (at least the cover);
  the gallery says it is available once online. Show-off works offline with the covers on the phone.
- **Game without a BoardGameGeek page or details pending**: the viewer shows the initials hexagon
  big; no gallery.
- **Very large galleries** (hundreds of photos on BGG): the viewer shows a capped number of the most
  relevant images (see Assumptions) and loads further images as the user swipes, not all at once.
- **Slow images**: a placeholder in the image's place while it loads; the swipe still works; a
  failed image shows a short note in its place.
- **Many games in Show-off** (100+): the honeycomb scrolls smoothly; covers load as they come into
  view.
- **Wide screens**: the honeycomb keeps three across within the column (hexagons grow); the viewer
  fills the screen with the image fitted, not cropped.
- **Reduced motion**: images change without sliding; closing does not animate.
- **Pinch to zoom** inside the viewer: allowed (the browser's zoom of the image); swiping between
  images only happens when not zoomed.
- **A game changes mark** while Show-off is open in another tab or device: the screen reflects the
  groups as of opening; reopening Show-off updates it.

## Requirements *(mandatory)*

### Functional Requirements

**Big image viewer**

- **FR-001**: Tapping the cover in a game's details sheet (in a collection and in a BGG list) MUST
  open a full-screen image viewer showing the game's main image in a large size and its name.
- **FR-002**: The viewer MUST let the user move through the game's BoardGameGeek image gallery by
  swiping left and right (and by arrow keys and on-screen previous/next controls), showing the
  position ("3 / 24"); it MUST not wrap around at the ends.
- **FR-003**: The viewer MUST close by its X button, by Back or Escape, and by swiping down, returning
  to where it was opened (details sheet or Show-off screen).
- **FR-004**: Gallery images MUST be loaded only when the viewer is opened and as the user swipes,
  never in the background for games the user did not open (respectful BoardGameGeek use); loaded
  gallery data MUST be kept so reopening the same game does not load it again.
- **FR-005**: When the gallery is unavailable (offline, BoardGameGeek slow or failing, no images),
  the viewer MUST still show the best image on the phone and one short line saying why there are
  no more images.
- **FR-006**: Every image MUST have a text alternative with the game's name and position; the viewer
  MUST be usable by keyboard and screen reader (focus moves into it and back to the cover on close).

**Show-off**

- **FR-002a**: Moving between images MUST slide the images in place without redrawing the viewer, so
  nothing of the screen behind it shows during a swipe.
- **FR-007**: In a collection with games, the action bar MUST offer a **Show-off** action (outer right,
  after Filter).
- **FR-008**: Show-off MUST open a sheet to select one or more of the six groups, each with its mark
  and the number of games in it; the confirm action MUST be disabled while none is selected.
- **FR-009**: The selection MUST be remembered per collection on the device and preselected next
  time; the first time Must Have is preselected.
- **FR-010**: Confirming MUST open the Show-off screen: one hexagon per game of the selected groups,
  ordered by mark (collection order) and by name, laid out as a honeycomb three across with
  alternate rows shifted by half a hexagon so the hexagons touch edge to edge.
- **FR-011**: Each hexagon MUST show the game's cover filling it (initials when there is none) and
  the bought tick for bought games; its accessible name MUST be the game's name and mark.
- **FR-012**: Tapping a hexagon MUST open the big image viewer for that game (FR-001–FR-006).
- **FR-013**: The Show-off screen MUST have a heading with the collection's name and the chosen
  groups' marks, a back button to the collection, and an empty state when no game matches.
- **FR-014**: The Show-off screen MUST work offline with the covers on the phone and must not change
  any game (it is a view only).

**Look**

- **FR-015**: The viewer, the group selection sheet and the honeycomb MUST follow the design rules
  (dark viewer background, hexagon covers, sheet rules, touch targets, reduced motion).

### Key Entities

- **Game image**: one picture of a game from BoardGameGeek: a small version (as today's covers) and
  a large version; part of a game's gallery, in BoardGameGeek's order.
- **Game gallery**: the images of one game as BoardGameGeek offers them, with how many there are;
  loaded on demand and kept on the phone for reuse.
- **Show-off selection**: per collection on the device: which groups were shown last.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a game's details sheet, the big image is on screen in 1 tap and within 2 seconds on a
  normal mobile connection (the cover itself instantly, the sharp version as soon as it arrives).
- **SC-002**: Moving to the next gallery image takes one swipe and the image appears within 1 second
  for images already loaded.
- **SC-003**: From a collection, a Show-off honeycomb of the chosen groups is on screen in 3 taps
  (Show-off, adjust groups, confirm), and with the remembered selection in 2.
- **SC-004**: A Show-off of 100 games scrolls without visible stutter on a mid-range phone.
- **SC-005**: Opening the same game's gallery a second time makes no new request to BoardGameGeek.
- **SC-006**: The accessibility check finds no violations in the viewer, the sheet and the Show-off
  screen; all works with reduced motion.

## Assumptions

- The look was agreed in the design review on 2026-10-20 (honeycomb three per row with shifted rows,
  Show-off at the right edge; see [design.md](design.md)).

- "Gallery" means the images BoardGameGeek shows for the game (its image gallery); the viewer starts
  with the game's main image and then shows the gallery in BoardGameGeek's own order (most relevant
  first), capped at the first 50 images; that is plenty to get an impression at the fair.
- The large version of an image is the size BoardGameGeek offers for viewing on a screen, not the
  original upload (which can be very large).
- The viewer is also opened from a BGG list's game sheet (same details); the swipe card in BG-Tinder
  keeps its own behaviour (swiping there decides), so it does not open the viewer.
- Show-off is per collection; groups use the collection's group order from feature 003 (Must Have,
  Interested, Unsure, Poop, Not yet marked, Not interested).
- Show-off is a view, not a share: sharing it as a picture is not part of this feature.
- The selection is remembered per device, not synced (like other view choices such as filters).
- Reading BoardGameGeek's image gallery follows the constitution's BoardGameGeek rules: only through
  the app's server, on demand, cached, with the time-limited exception for data the official API
  does not offer.
