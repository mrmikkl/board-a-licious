# Feature Specification: BGG Game Collection

**Feature Branch**: `001-bgg-game-collection`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "It is meant to work with the page boardgamegeek.com. You should be able
to search for board games on that page in general, or search specifically from a geeklist (e.g. the
geeklist for Spiel 26 Preview). These board games we want to be able to put in a collection — the ones
that we mark — and on them we want to put states which will help us during the Spiel 26 fair:
'Interested', 'Must Have', 'Poop', and later maybe more. Mainly used on smartphones."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add a game from a BoardGameGeek link (Priority: P1)

While browsing BoardGameGeek on their phone (e.g. the Spiel 26 Preview geeklist), a user copies a
game's link, pastes it into the app and picks a state. The app needs no access to BoardGameGeek's
data for this, so it works before the app's BoardGameGeek access is approved.

**Why this priority**: The simplest way to add any game, including games on no geeklist, and it
works even when BoardGameGeek data cannot be loaded at all.

**Independent Test**: Copy the link of a game page on boardgamegeek.com, paste it, assign "Must
Have", reload, and confirm the game is in the collection with a readable name and a working link.

**Acceptance Scenarios**:

1. **Given** a link like `https://boardgamegeek.com/boardgame/295947/cascadia`, **When** the user
   pastes it, **Then** the app recognises the game and suggests the name "Cascadia", which the user
   can edit before saving.
2. **Given** a recognised link, **When** the user picks a state, **Then** the game is added with
   that state, a placeholder image and a link to its BoardGameGeek page.
3. **Given** a link to a game already in the collection, **When** it is pasted, **Then** the app
   shows the existing entry and its state instead of adding a duplicate.
4. **Given** text that is not a BoardGameGeek game link (e.g. a geeklist or user page), **When** it
   is pasted, **Then** the user is told which kind of link is expected.
5. **Given** games added by link, **When** BoardGameGeek data for them can be loaded,
   **Then** their names, years and thumbnails are completed from BoardGameGeek without changing
   their states.

---

### User Story 2 - Browse and search geeklists and mark games (Priority: P2)

Before the fair, the group goes through a large preview geeklist (e.g. "Spiel 26 Preview") on their
phones, scrolling through its entries and marking the ones they care about.

**Why this priority**: The Spiel preview geeklist is the main source for discovering fair releases
and contains nearly every game relevant for the fair. Searching inside loaded geeklists is the only
name search available in Release 0.5 (before official BoardGameGeek data access).

**Independent Test**: Open a known geeklist, mark three of its games with different states, and
confirm they appear in the collection with those states.

**Acceptance Scenarios**:

1. **Given** the user provides a geeklist link or ID, **When** it loads, **Then** they see the
   geeklist's title and its game entries in geeklist order.
2. **Given** a loaded geeklist, **When** the user filters by name, **Then** only entries whose game
   name matches are shown.
3. **Given** one or more loaded geeklists, **When** the user searches by game name from the search
   screen, **Then** matching games from all loaded geeklists are shown once each, also without a
   network connection.
4. **Given** a geeklist with hundreds of entries, **When** it is opened the first time, **Then** the
   first entries appear quickly and the rest load in the background with visible progress.
5. **Given** a geeklist entry, **When** the user assigns a state, **Then** the game is added to the
   collection with its name, year and thumbnail.
6. **Given** a geeklist entry that is already in the collection, **When** the list is shown,
   **Then** the entry shows its current state.
7. **Given** a geeklist that the user opened before, **When** they open the app again, **Then** they
   can reopen it without entering the link again.

---

### User Story 3 - Search all of BoardGameGeek and mark a game (Priority: P3, Release 1.0)

At home or on the fair floor, a user types part of a game's name, sees matching games from
BoardGameGeek, and marks one with a state ("Interested", "Must Have" or "Poop"). The game then
appears in the collection with that state.

**Why this priority**: Finds games that are on no loaded geeklist. It depends on official
BoardGameGeek data access, which may only be granted after the fair, so it ships in Release 1.0;
until then adding by link (User Story 1) covers such games.

**Independent Test**: Search for a known game title, mark it "Must Have", reload the app, and
confirm the game is still in the collection with that state.

**Acceptance Scenarios**:

1. **Given** the user is on the search screen, **When** they search for "Cascadia", **Then** they see
   a list of matching games, each with name, year published and thumbnail where available.
2. **Given** a search result, **When** the user assigns the state "Interested", **Then** the game is
   added to the collection with state "Interested" and the result shows that state.
3. **Given** a game already in the collection, **When** it appears in a later search, **Then** the
   result shows its current state.
4. **Given** a search with no matches, **When** results load, **Then** the user sees a clear
   "no games found" message.

---

### User Story 4 - Use the collection at the fair (Priority: P4)

On the fair floor, a user opens the collection, filters it to "Must Have", and works through the
list. They change states as they go (e.g. a game turns out to be "Poop" after a demo) or remove a
game entirely.

**Why this priority**: This is the payoff during the fair, but it only makes sense once games have
been collected (P1–P3).

**Independent Test**: With a collection of games in mixed states, filter by each state, change one
game's state and remove another, then confirm the collection reflects both changes after reload.

**Acceptance Scenarios**:

1. **Given** a collection with games in several states, **When** the user filters by "Must Have",
   **Then** only "Must Have" games are shown, with a count per state visible.
2. **Given** a game in the collection, **When** the user changes its state, **Then** the new state
   is shown immediately and kept after reload.
3. **Given** a game in the collection, **When** the user removes it, **Then** it no longer appears in
   the collection.
4. **Given** a game in the collection, **When** the user opens it, **Then** they can follow a link to
   the game's BoardGameGeek page.

---

### User Story 5 - Share, back up and restore the collection (Priority: P5)

A user sends their "Must Have" list to the group chat (e.g. WhatsApp) so friends can see what they
plan to buy. Before the fair they save a backup of their collection, and if they switch phones or
lose their data they restore it from that backup.

**Why this priority**: Collections are personal (FR-012); sharing gives the group a view of each
other's lists, and a backup file the user holds protects against losing a collection or the service.
Both build on an existing collection (P1–P4).

**Independent Test**: With a collection in mixed states, share it to a messaging app and check the
message is readable; export a backup, clear the app's data, import the backup and confirm the
collection is identical.

**Acceptance Scenarios**:

1. **Given** a collection, **When** the user chooses "Share", **Then** they pick which states to
   include (default: all) and the phone's standard share menu opens with a plain-text message.
2. **Given** a shared message, **When** a friend reads it in a messaging app, **Then** games are
   grouped by state, each with its name and a link to its BoardGameGeek page, and the message
   reads well without any app installed.
3. **Given** a collection, **When** the user chooses "Export backup", **Then** they receive a
   single file containing every game and its state, which they can save or send.
4. **Given** a backup file, **When** the user imports it, **Then** its games are added to the
   collection; for games already present, the user chooses whether the backup or the current
   state wins.
5. **Given** a file that is not a valid backup, **When** the user imports it, **Then** they are
   told it cannot be read and the collection is unchanged.

---

### Edge Cases

- BoardGameGeek is slow or unavailable: search and geeklist loading show a clear, retryable message;
  the collection remains fully readable and editable.
- The phone has poor or no connectivity at the fair: the collection is still shown and state changes
  are not lost.
- A geeklist is very large (hundreds of entries): it remains scrollable and filterable on a phone.
- A geeklist contains entries that are not board games (e.g. publishers, expansions, text-only
  entries): non-game entries are skipped; expansions are shown like games.
- A geeklist link is invalid or the geeklist does not exist: the user is told so.
- The same game appears in several geeklists or searches: it exists only once in the collection.
- A game has no thumbnail: a neutral placeholder is shown.
- The user clears their browser data or switches phones: after signing in again, their collection
  is restored from their account.
- The same person changes the same game on two devices: the most recent change wins.
- The phone has no share menu (e.g. some desktop browsers): the share text is copied to the
  clipboard instead, and the user is told so.
- A shared selection or collection is empty: sharing is not offered and the user is told why.
- A visitor who is not invited opens the link: they are stopped at sign-in and see no app content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to search BoardGameGeek games by name and see matching games with
  name, year published and thumbnail when available.
- **FR-002**: Users MUST be able to load a BoardGameGeek geeklist by pasting its link or entering its
  ID, and see its game entries in geeklist order.
- **FR-003**: Users MUST be able to filter a loaded geeklist by game name.
- **FR-004**: The app MUST remember geeklists the user has opened so they can reopen them.
- **FR-005**: Users MUST be able to assign exactly one state to a game from search results, geeklist
  entries and the collection; assigning a state to a game not yet in the collection adds it.
- **FR-006**: The app MUST provide the states "Interested", "Must Have" and "Poop"; the set of states
  MUST be extendable later without changing how existing games are stored.
- **FR-007**: Users MUST be able to change a game's state and remove a game from the collection.
- **FR-008**: The collection MUST be viewable as a list filterable by state, showing the number of
  games per state.
- **FR-009**: Each game in the collection MUST link to its BoardGameGeek page.
- **FR-010**: Wherever a game is shown (search, geeklist, collection), its current collection state
  MUST be visible.
- **FR-011**: The collection MUST survive app reloads and remain readable and editable when
  BoardGameGeek or the network is unavailable.
- **FR-012**: Each person MUST have their own collection, stored with their account and available on
  every device they sign in on; collections are not shared between people. A copy MUST be kept on
  the device so the collection works offline, and offline changes MUST be synchronized once the
  device is back online.
- **FR-013**: Only invited people MUST be able to open the app; each person MUST sign in individually
  through an external identity provider, and the app itself MUST NOT store passwords. Uninvited
  visitors MUST NOT reach any screen or any of the app's access to BoardGameGeek.
- **FR-014**: All screens MUST be usable on a phone-width screen with touch, and meet WCAG 2.2 AA.
- **FR-015**: The app MUST limit and cache its requests to BoardGameGeek so that reopening a search or
  geeklist does not fetch the same data again within a session.
- **FR-016**: Users MUST be able to share their collection, or selected states of it, as a plain-text
  message through the device's standard share menu (e.g. WhatsApp, Signal, email), grouped by state
  with game names and BoardGameGeek links.
- **FR-017**: Users MUST be able to export their whole collection to a single backup file and import
  such a file on any device; importing MUST NOT silently overwrite existing states.
- **FR-018**: Users MUST be able to add a game by pasting a BoardGameGeek game or expansion link;
  the app MUST derive the game's ID and a suggested name from the link alone, without contacting
  BoardGameGeek, and let the user edit the name.
- **FR-019**: Search across all of BoardGameGeek (User Story 3) MUST become available once official
  BoardGameGeek data access is granted (Release 1.0), without changing collections or other
  features. Until then the search screen MUST search loaded geeklists only and say so.
- **FR-020**: Users MUST be able to search by game name across all geeklists they have loaded on
  the device, including without a network connection.
- **FR-021**: Games added by link MUST be completed with name, year and thumbnail from
  BoardGameGeek as soon as that data can be loaded, without changing their states.

### Key Entities

- **Game**: A board game on BoardGameGeek, identified by its BGG ID; name, year published, thumbnail
  and link come from BGG.
- **State**: A label expressing interest in a game ("Interested", "Must Have", "Poop", more later).
- **Collection Entry**: A game that has been marked, with its current state and when it was last
  changed.
- **Geeklist**: A BGG list identified by its ID, with a title and ordered entries referencing games.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find a game by name and mark it with a state in under 20 seconds on a phone.
- **SC-002**: A user can load the Spiel 26 Preview geeklist and start marking entries in under 10
  seconds on a typical mobile connection.
- **SC-003**: Changing a game's state takes at most 2 taps from wherever the game is shown.
- **SC-004**: With no network connection, 100% of the collection remains viewable and state changes
  made offline are not lost.
- **SC-005**: During the fair, every member of the group uses the app instead of paper or chat lists
  to track games.
- **SC-006**: Every core flow (search, geeklist, collection) is completable on a 360px-wide screen
  without horizontal scrolling or zooming.
- **SC-007**: 100% of attempts to open the app without an invited sign-in are refused.
- **SC-008**: A user can send their "Must Have" list to a group chat in under 15 seconds.
- **SC-009**: Exporting a backup and importing it on another device restores 100% of games and
  states.
- **SC-010**: Before SPIEL Essen 2026 opens (2026-10-22), each user can load the Spiel 26 Preview
  geeklist, find a game in it by name and set its state in under 15 seconds, without official
  BoardGameGeek data access.

## Assumptions

- Users are the author and a small group of friends (fewer than 10 people); no public sign-up. The
  author manages who is invited.
- Collections are stored centrally per person and cached on each device; conflicting edits are
  resolved by "most recent change wins". Opened geeklists (FR-004) are remembered per device.
- Shared messages are read-only text; importing a friend's shared message into one's own collection
  is out of scope.
- A game has exactly one state at a time per collection entry; there is no "no state" entry —
  removing the state removes the game from the collection.
- Geeklists are identified by link or ID; searching for geeklists by title is out of scope.
- Personal notes, ratings, booth/hall locations, prices and purchase tracking are out of scope for
  this feature.
- Searching and loading geeklists require a network connection; only the collection must work
  offline.
- Release 0.5 (before the fair) works without official BoardGameGeek data access; it uses data
  BoardGameGeek's website exposes publicly, under the time-limited exception in constitution
  Principle V. Release 1.0 switches to the official access once granted and adds full search.
- Web search through external search engines, AI models or company infrastructure is out of
  scope.
- Writing back to BoardGameGeek (e.g. updating a user's BGG collection) is out of scope.
- The app relies on BoardGameGeek's public data and follows its terms of use; access to that data
  may require registering the app with BoardGameGeek.
