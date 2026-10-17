# Feature Specification: BGG Game Collection

**Feature Branch**: `001-bgg-game-collection`

**Created**: 2026-10-16 | **Updated**: 2026-10-17 (design session, see [design.md](design.md))

**Status**: Draft

**Input**: User description: "It is meant to work with the page boardgamegeek.com. You should be able
to search for board games on that page in general, or search specifically from a geeklist (e.g. the
geeklist for Spiel 26 Preview). These board games we want to be able to put in a collection — the ones
that we mark — and on them we want to put states which will help us during the Spiel 26 fair:
'Interested', 'Must Have', 'Poop', and later maybe more. Mainly used on smartphones."

Product context: [docs/vision.md](../../docs/vision.md). Look and feel: [docs/design.md](../../docs/design.md)
and this feature's [design.md](design.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Collections and marking games (Priority: P1)

A user creates a collection, for example "Essen 2026" as an Essen collection, adds a game by
pasting its BoardGameGeek link, and marks it Must Have. The collection shows its games grouped by
mark, with not-yet-marked games on top.

**Why this priority**: Without collections and marks there is nothing to work with; adding by link
works without any BoardGameGeek data access, so this slice is usable on its own.

**Independent Test**: Create an Essen collection, add a game by link, mark it, reload the app, and
confirm the collection, the game and its mark are still there.

**Acceptance Scenarios**:

1. **Given** no collections, **When** the user creates one with a name and the Essen switch on,
   **Then** it appears in the collections list with an Essen badge and opens empty, offering
   "Add from BGG list" and "Add by link".
2. **Given** an open collection, **When** the user pastes a link like
   `https://boardgamegeek.com/boardgame/295947/cascadia` and confirms, **Then** the game is added
   under "Not yet marked" with the suggested, editable name "Cascadia", and the user is back in
   the collection.
3. **Given** a game in a collection, **When** the user opens it and picks Must Have, Interested,
   Unsure or Poop, **Then** it moves to that group immediately; "Not interested" moves it to a
   collapsed group at the bottom.
4. **Given** several collections, **When** the user looks at the collections list, **Then** each
   shows its number of games per mark and the number bought.
5. **Given** the add button (+), **When** the user picks "Game", pastes a link and chooses a
   collection from the dropdown, **Then** the game is added to that collection.

---

### User Story 2 - Load BGG lists and put their games into collections (Priority: P2)

Before the fair the user loads a BGG list by its link: the SPIEL Essen 2026 preview. They
browse its games with booth, price and publisher, open one, tick the collections it should be in,
and press Done.

**Why this priority**: The SPIEL preview is where fair releases are found; it also brings the
booth, price and publisher needed at the fair.

**Independent Test**: Load the SPIEL preview, open a game, tick an Essen and a standard collection,
press Done, and confirm the game is in both, with booth, price and publisher only in the Essen one.

**Acceptance Scenarios**:

1. **Given** a BGG list link, **When** the user loads it, **Then** it is listed; a BGG preview (such
   as SPIEL Essen 2026) gets an Essen badge and its games show booth, price and publisher, a
   geeklist shows its games without them.
2. **Given** a large list, **When** it is opened the first time, **Then** the first games appear
   quickly and the rest load in the background with visible progress; it stays available offline.
3. **Given** a loaded list, **When** the user filters by name, **Then** only matching games show.
4. **Given** a game in a list, **When** the user opens it, **Then** the collections it is already in
   are ticked; ticking or unticking changes nothing until Done, and Done adds and removes exactly
   as ticked; Cancel discards.
5. **Given** a game from an Essen list ticked into a standard collection, or a game from a geeklist
   ticked into an Essen collection, **When** the user looks at the tick, **Then** it says the game is
   added without booth and price.

---

### User Story 3 - Swipe through a BGG list (Priority: P3)

In a collection the user chooses "Add from BGG list", picks the SPIEL preview, and swipes: right
adds a game, left marks it "Not interested". Each card shows cover, name, year, a short
description and, for Essen lists, booth, price and publisher.

**Why this priority**: The fastest way through hundreds of preview games; builds on US1 and US2.

**Independent Test**: Swipe ten games of a list into a collection and confirm the right-swiped
ones are under "Not yet marked", the left-swiped ones under "Not interested", and none of them is
offered again.

**Acceptance Scenarios**:

1. **Given** a collection and a list, **When** the user swipes right (or presses ✓ or →),
   **Then** the game is added unmarked and the next card appears.
2. **When** the user swipes left (or presses ✕ or ←), **Then** the game is added as Not interested.
3. **Given** games already in the collection, **When** swiping, **Then** they are not shown again;
   when all are decided, the user is told so.

---

### User Story 4 - Use a collection at the fair (Priority: P4)

On the fair floor the user filters the Essen collection to "Must Have, not bought", walks to the
booth shown, buys a game, marks it "Bought it" and enters the price paid. The game keeps its mark
and gets a bought badge; the collection shows how much has been spent.

**Why this priority**: The payoff at the fair; needs games in a collection first.

**Independent Test**: In a collection with games in several groups, apply the "Must Have, not
bought" preset, mark one game bought at a price, and confirm it disappears from that view, keeps its
group in "All games", shows the price, and the total spent is correct.

**Acceptance Scenarios**:

1. **Given** a collection, **When** the user opens the filter, **Then** they can select any
   combination of groups and choose All / Not bought / Bought; presets "All" and "Must Have, not
   bought" set both at once; the filter button shows the selection and the number of games shown.
2. **Given** a game, **When** the user taps "Bought it", **Then** they are asked what they paid,
   prefilled with the listed price if there is one, and can also skip the price.
3. **Given** bought games, **When** the collection is shown, **Then** each keeps its group, shows a
   bought badge with the price paid, and a line shows the number bought and the money spent.
4. **Given** a game without booth, price or publisher, **When** the user opens its details, **Then**
   they can add or edit them by hand, and the game shows them like data from an Essen list, marked as added by
   the user.
5. **Given** a game, **When** the user opens its details, **Then** they see its cover, a short
   description and a link to its BoardGameGeek page.

---

### User Story 5 - Share, back up and restore (Priority: P5)

The user sends the Must Haves of their Essen collection to the group chat, with booths and prices,
and keeps a backup file of all collections.

**Why this priority**: Gives friends a view of each other's lists and protects against data loss.

**Independent Test**: Share a collection to a messaging app and check the text is readable; export a
backup, delete a collection, import the backup and confirm it is back unchanged.

**Acceptance Scenarios**:

1. **Given** collections, **When** the user picks one and the groups to include, **Then** the
   phone's share menu opens with a plain-text message: games grouped by mark, each with its
   BoardGameGeek link, booth and price for Essen collections, and ✅ before bought games.
2. **Given** collections, **When** the user exports a backup, **Then** they get one file with all
   collections, games, marks, bought state, prices and facts.
3. **Given** a backup file, **When** the user imports it, **Then** missing collections are restored
   and nothing is overwritten silently; an invalid file changes nothing and says why.

---

### User Story 6 - Search all of BoardGameGeek (Priority: P6, Release 1.0)

The user types a game name and adds results to a collection.

**Why this priority**: Depends on official BoardGameGeek API access, which may only be granted after
the fair. Until then the search tab is visible but switched off and points to adding by link.

**Independent Test**: With API access, search "Cascadia", add the result to a collection.

**Acceptance Scenarios**:

1. **Given** no API access, **When** the user opens Search, **Then** they see that search comes
   later and a way to add by link instead.
2. **Given** API access, **When** the user searches by name, **Then** matching games appear with
   cover and year and can be added to a collection.

---

### Edge Cases

- BoardGameGeek is slow or unavailable: lists and search show a clear, retryable message;
  collections stay fully usable.
- No network at the fair: collections, loaded lists and all marking work offline; changes sync
  later.
- Huge lists (thousands of entries) stay scrollable and filterable on a phone.
- List entries that are not games are skipped; expansions are shown like games.
- Invalid or non-game links are rejected with a message saying which link is expected.
- A game already in a collection is never added twice; it can be in several collections, with a
  separate mark in each.
- Unticking a collection in a list game's sheet removes the game there, including its mark and
  bought state; the sheet says so before Done.
- A collection is empty: a centred empty state offers both ways to add games.
- The selected filter shows nothing: the user is told so; with the "Must Have, not bought" preset
  the message celebrates that nothing is left to hunt.
- Price paid is not known: bought can be recorded without a price; it does not count towards the
  money spent.
- A game has no cover or description yet: initials in a hexagon and a note that the description
  follows from BoardGameGeek.
- Sound is unwanted: it can be muted, and the choice is remembered. Phones without web vibration
  (iPhone) simply do not vibrate.
- Reduced motion is set on the device: animations and the moving background are off.

## Requirements *(mandatory)*

### Functional Requirements

**Collections and marks**

- **FR-001**: Users MUST be able to create any number of collections, each with a name and a type:
  **Essen** or **standard**.
- **FR-001a**: Users MUST be able to rename and delete a collection; deleting asks for confirmation
  and removes all its games, marks, bought states and prices. A collection's type cannot change after
  creation.
- **FR-002**: The collections list MUST show each collection with its type and the number of games
  per mark and bought.
- **FR-003**: A game MAY be in several collections; each membership has its own mark, bought state
  and facts.
- **FR-004**: Marks MUST be: Not yet marked (default), Must Have, Interested, Unsure, Poop, Not
  interested; the set MUST be extendable without changing stored data.
- **FR-005**: A collection MUST show its games grouped by mark in the order of FR-004, Not yet marked
  first and Not interested collapsed by default.
- **FR-006**: Users MUST be able to change a game's mark from its details (see SC-003) and remove a
  game from a collection.

**Bought and filtering**

- **FR-007**: Users MUST be able to mark a game as bought independently of its mark, optionally with
  the price paid (suggested from the listed price), and undo it. A bought game stays in its group
  and shows a bought badge with the price.
- **FR-008**: A collection MUST show how many games are bought and the total price paid per
  currency (e.g. "€152 + $40"); a price paid is entered in the currency of the listed price,
  defaulting to EUR.
- **FR-009**: Users MUST be able to filter a collection by any combination of groups and by bought
  state (all / not bought / bought), with presets "All" and "Must Have, not bought".

**Booth, price and publisher ("facts")**

- **FR-010**: Facts MUST be kept when a game comes from an Essen list into an Essen collection,
  and only then; the UI MUST say so before adding in every other combination.
- **FR-011**: Users MUST be able to add or edit facts of a game in a collection by hand; such facts
  are shown as added by the user.

**BGG lists**

- **FR-012**: Users MUST be able to load a BGG list by its link: a BoardGameGeek preview (an
  Essen list, with booth, price and publisher) or a geeklist (no facts); loaded lists are
  remembered on the device, load page by page with visible progress and are available offline.
- **FR-013**: Users MUST be able to browse a loaded list, filter it by name and see each game's
  facts (Essen lists) and whether it is in a collection.
- **FR-014**: From a game in a list, users MUST be able to choose the collections the game belongs to;
  the choice MUST start from the current memberships and apply only on confirmation.
- **FR-015**: Inside a collection, users MUST be able to go through a list card by card, adding
  (right) or marking Not interested (left); games already in the collection MUST NOT be offered.

**Adding single games**

- **FR-016**: Users MUST be able to add a game by pasting its BoardGameGeek game link: inside a
  collection (no collection choice) or from the add button with a collection dropdown. The game ID
  and a suggested name MUST come from the link alone; the name is editable. If the user has no
  collection yet, the add flow MUST offer to create one first (name prefilled "SPIEL 2026", Essen)
  and then continue with the game.
- **FR-017**: Games added by link MUST be completed with name, year, cover and description from
  BoardGameGeek as soon as that data can be loaded, without changing marks.

**Game details**

- **FR-018**: Game details MUST show cover, name, year, a short description, facts and a link to the
  game's BoardGameGeek page.

**Search**

- **FR-019**: Search across all of BoardGameGeek MUST become available once official data access is
  granted (Release 1.0); until then the search screen MUST say so and offer adding by link.

**Share and backup**

- **FR-020**: Users MUST be able to share one collection, with chosen groups, as plain text through
  the device's share menu (clipboard where none exists): grouped by mark, BoardGameGeek links, booth
  and price for Essen collections, bought games marked.
- **FR-021**: Users MUST be able to export all collections to one backup file and import it on any
  device; importing MUST NOT silently overwrite existing data.

**Accounts, storage, quality**

- **FR-022**: Each person's collections MUST be stored with their account and available on every
  device they sign in on; a copy MUST stay on the device for offline use and offline changes MUST
  synchronise when back online.
- **FR-023**: Only invited people MUST be able to open the app; each signs in individually through an
  external identity provider; the app stores no passwords; uninvited visitors reach no screen and
  none of the app's access to BoardGameGeek.
- **FR-024**: All screens MUST work on a phone-width screen with touch, meet WCAG 2.2 AA and follow
  [docs/design.md](../../docs/design.md).
- **FR-025**: The app MUST limit and cache its requests to BoardGameGeek.
- **FR-026**: Marking games MAY play a short sound and vibrate where the device supports it; sound
  MUST be mutable and the choice remembered; motion MUST respect the device's reduced-motion setting.
- **FR-027**: On first start the app MUST offer a short skippable introduction that can be shown
  again later.

### Key Entities

- **Game**: a BoardGameGeek game, identified by its BGG ID; name, year, cover, short description and
  link come from BGG.
- **Collection**: a person's named list, type Essen or standard.
- **Collection entry**: a game in a collection: mark, bought (yes/no), price paid (optional), facts
  (booth, price, publisher; from an Essen list or added by hand), when it last changed.
- **Mark**: Not yet marked, Must Have, Interested, Unsure, Poop, Not interested.
- **BGG list**: a BoardGameGeek preview or geeklist identified by kind and ID, with title, Essen
  flag (previews), load progress and ordered
  entries (game + facts for Essen lists).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can add a game by link and mark it in under 20 seconds on a phone.
- **SC-002**: A user can load the SPIEL Essen 2026 preview and see its first games in under 10
  seconds on a typical mobile connection.
- **SC-003**: Changing a game's mark takes at most 2 taps from the collection.
- **SC-004**: With no network connection, 100% of collections and loaded lists remain usable and
  no change made offline is lost.
- **SC-005**: During the fair, every member of the group uses the app instead of paper or chat lists.
- **SC-006**: Every flow is completable on a 360px-wide screen without horizontal scrolling or zooming.
- **SC-007**: 100% of attempts to open the app without an invited sign-in are refused.
- **SC-008**: A user can send their Must Haves to a group chat in under 15 seconds.
- **SC-009**: Exporting a backup and importing it on another device restores 100% of collections,
  marks, bought states, prices and facts.
- **SC-010**: Before SPIEL Essen 2026 opens (2026-10-22), each user can load the SPIEL preview and
  swipe through it without official BoardGameGeek data access.
- **SC-011**: Swiping, a user decides on at least 15 games per minute, counted over 20 consecutive
  cards from the first card shown, with the list's first page already loaded.
- **SC-012**: From opening the app on the Collections screen (signed in, intro already seen), the
  "Must Have, not bought" list of a collection is reached in at most 4 taps, counting every tap
  including opening the filter.

## Assumptions

- Users are the author and a small group of friends (fewer than 10); no public sign-up. The author
  manages who is invited.
- Collections are personal; sharing happens as text or backup files. Seeing friends' marks in the
  app is out of scope for this feature.
- Collections are stored centrally per person and cached on each device; conflicting edits are
  resolved by "most recent change wins". Loaded lists are stored per device.
- Release 0.5 (before the fair) works without official BoardGameGeek data access, using data BGG's
  website exposes publicly under the time-limited exception in constitution Principle V. Release 1.0
  switches to the official access and adds full search.
- Web search through external search engines, AI models or company infrastructure is out of scope.
- Personal notes, ratings, hall-by-hall routing and purchase handling are out of scope for this
  feature (hall view is a later idea, see the vision).
- Writing back to BoardGameGeek (e.g. a user's BGG collection) is out of scope.
- Undoing the last swipe decision and showing the sync status are out of scope for Release 0.5; a
  wrong swipe is corrected in the game's details, and sync happens automatically in the background.
- The app relies on BoardGameGeek's public data and follows its terms of use; access to that data
  may require registering the app with BoardGameGeek.
