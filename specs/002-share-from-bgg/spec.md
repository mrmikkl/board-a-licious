# Feature Specification: Share from BGG into the App

**Feature Branch**: `002-share-from-bgg`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Share a game from BoardGameGeek into the app (Android share target). On
the phone, in the BGG app or on boardgamegeek.com in the browser, the user taps Share on a game and
picks board-a-licious; the app opens, recognises the game from the shared link, shows its name and
cover, and lets the user put it into one of their collections (same as "Add game", with the
collection chosen in the sheet) in two taps. Works for game and expansion pages; links that are not a
BGG game say so. If the person is not signed in or offline, the game is kept and added once possible.
The app must be installed to the home screen (PWA) for it to appear in the share menu."

Product context: [docs/vision.md](../../docs/vision.md) ("Later ideas": sharing straight from BGG into
the app). Builds on feature [001](../001-bgg-game-collection/spec.md): collections, adding a game by
link (FR-016), completing games with BGG details (FR-017), offline and sync. Look and feel:
[docs/design.md](../../docs/design.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share a game from BGG into a collection (Priority: P1)

At the fair or on the sofa, the user looks at a game in the BoardGameGeek app or on
boardgamegeek.com, taps Share and picks board-a-licious. The app opens with a sheet showing the game
(name and cover), the collection to put it in (the one used last, changeable) and one button to add
it. One tap adds the game to the collection, Not yet marked; the user is then in that collection.

**Why this priority**: This is the whole point of the feature: getting a game from BGG into a
collection without copying links. Everything else builds on it.

**Independent Test**: On an Android phone with the app on the home screen, share
`https://boardgamegeek.com/boardgame/295947/cascadia` from the browser to board-a-licious and tap
the add button: Cascadia is in the chosen collection.

**Acceptance Scenarios**:

1. **Given** the app is on the home screen and the user has collections, **When** they share a BGG
   game page to board-a-licious, **Then** the app opens a sheet with the game's name and cover, the
   last used collection preselected, and an add button.
2. **Given** that sheet, **When** the user taps the add button, **Then** the game is in the chosen
   collection under Not yet marked, a confirmation names game and collection, and the collection is
   shown.
3. **Given** that sheet, **When** the user picks another collection first, **Then** the game goes
   into that one, and it is preselected next time.
4. **Given** the shared game is already in the chosen collection, **When** the sheet opens, **Then**
   it says so and the add button is disabled until another collection is chosen.
5. **Given** the user has no collection yet, **When** they share a game, **Then** the sheet offers
   to create one first (name prefilled "SPIEL 2026") and then adds the game to it.
6. **Given** the shared text is not a BGG game or expansion page, **When** the app opens, **Then**
   it says the link is not a BoardGameGeek game and offers to close or to add a game by link.

---

### User Story 2 - Share while offline or signed out (Priority: P2)

At the fair the phone may have no signal, or the sign-in may have run out. A shared game must not
get lost: it is added on the device right away, and reaches the account as soon as the app is online
and signed in again.

**Why this priority**: The fair is where sharing is most useful and where the connection is
weakest; losing a shared game there breaks trust in the feature.

**Independent Test**: In airplane mode, share a BGG game page and add it: it shows in the
collection at once; after reconnecting, it appears on the second device.

**Acceptance Scenarios**:

1. **Given** the phone is offline, **When** the user shares a game and adds it, **Then** it is in
   the collection at once with its name from the link, and its cover and details follow once online.
2. **Given** the sign-in has expired, **When** the user shares a game, **Then** the game is added on
   the device as usual, the sign-in banner is shown, and the game syncs after signing in again.

---

### User Story 3 - Share a BGG list into the app (Priority: P3)

Sharing a BGG preview or geeklist page (instead of a single game) opens that list in the app, ready
to browse or swipe, the same as loading it by link.

**Why this priority**: Nice to have; loading a list by link already exists, this only removes the
copy and paste.

**Independent Test**: Share `https://boardgamegeek.com/geekpreview/93/spiel-essen-2026` to
board-a-licious: the list opens and starts loading.

**Acceptance Scenarios**:

1. **Given** a shared BGG preview or geeklist page, **When** the app opens, **Then** it shows that
   list (loading it if it is new), as if loaded by link.

---

### Edge Cases

- The shared text holds more than a link (BGG's app shares "Name – link"): the game link is found in
  the text; the name in the text may serve as the suggested name.
- The link points to an edition, a forum thread or an image of a game: if it names a game ID, that
  game is used; otherwise it is treated as not a game.
- Several links in one share: the first BGG game link is used.
- The app was not installed to the home screen: board-a-licious does not appear in the share menu;
  the Config screen (or the intro) explains how to add it to the home screen.
- The user cancels the sheet: nothing is added; the app shows the screen it would show on a normal
  start.
- The same game is shared twice quickly: it is added once.
- BGG cannot be reached: the game is added with the name from the link (or "Game <id>"), and name,
  cover and details are completed later (as in feature 001, FR-017).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The installed app MUST appear as a target in the phone's share menu for shared text
  and links (Android with Chrome; other platforms where their browser allows it).
- **FR-002**: When something is shared to the app, the app MUST find the first BoardGameGeek game or
  expansion link in the shared text and recognise the game ID from it, using the same link rules as
  adding a game by link (feature 001, FR-016).
- **FR-003**: For a recognised game the app MUST open a sheet with the game's name (from the device
  if known, else from the shared text or link, editable) and cover when available, a collection
  choice and an add button labelled "Add to collection".
- **FR-004**: The collection choice MUST preselect the collection the user shared into last, else the
  only or first collection; the choice MUST be remembered per person on the device.
- **FR-005**: Adding MUST put the game into the chosen collection under Not yet marked, exactly as
  adding by link does (marks of other collections unchanged, details completed later, synced to the
  person's other devices), confirm it, and then show that collection.
- **FR-006**: If the game is already in the chosen collection the sheet MUST say so and not add it a
  second time.
- **FR-007**: With no collection yet, the sheet MUST offer to create one first (name prefilled
  "SPIEL 2026") and then add the game to it.
- **FR-008**: Shared text without a BGG game link MUST lead to a clear message ("This is not a
  BoardGameGeek game link") with a way to close and a way to add a game by link instead.
- **FR-009**: Sharing and adding MUST work offline and with an expired sign-in: the game is stored on
  the device at once and synced once the app is online and signed in, without losing it.
- **FR-010**: A shared BGG preview or geeklist link MUST open that list in the app, as loading it by
  link does (feature 001, FR-012).
- **FR-011**: The app MUST tell users how to make it a share target: where board-a-licious is not
  installed to the home screen, Config MUST show a short hint how to add it.
- **FR-012**: Cancelling the sheet MUST add nothing.

### Key Entities

- **Shared item**: what the phone hands to the app: a title and/or text and/or a link. Only used to
  find a BGG game or list link; not stored.
- **Last share collection**: the collection the person last shared into on this device; used to
  preselect the choice.
- Collection, entry and game are those of feature 001.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From tapping Share in BGG to the game being in a collection takes at most two taps in
  the app and under 10 seconds with a normal connection.
- **SC-002**: 100% of BGG game and expansion page links shared from the BGG Android app and from
  Chrome are recognised (checked with at least 10 real links of each source).
- **SC-003**: A game shared offline is in the collection immediately and on the second device within
  one minute of reconnecting.
- **SC-004**: No shared game is added twice, and no game is added when the sheet is cancelled.

## Assumptions

- The friends use Android phones with Chrome; on iPhones a web app cannot be a share target, so the
  feature simply does not appear there (adding by link keeps working).
- The app is installed to the home screen (PWA); a share target only exists for installed web apps.
  Reinstalling or updating the installed app may be needed once after this feature ships.
- BGG's Android app shares game pages as text containing a boardgamegeek.com link (often with the
  game's name); the website shares its page URL.
- Adding reuses feature 001's rules for game links, collections, details completion, offline storage
  and sync; no new server data is needed beyond what adding by link already sends.
- Choosing a mark while sharing is out of scope: shared games start as Not yet marked, like games
  added by link (marking is one tap in the collection).
