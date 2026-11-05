# Feature Specification: Official BGG Data and Search

**Feature Branch**: `006-bgg-xml-search`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "use the official BGG XML API with our token, add search"

Product context: [docs/vision.md](../../docs/vision.md). Builds on features
[001](../001-bgg-game-collection/spec.md) (game details from BoardGameGeek, the switched-off Search
place, US6 / FR-019), [004](../004-show-off-gallery/spec.md) (image gallery) and
[005](../005-essen-feedback/spec.md) (ratings, adding with a category). Rules:
[constitution](../../.specify/memory/constitution.md) principle V (once a token exists the official
BoardGameGeek API must be used for every kind of data it offers) and
[ADR 0005](../../docs/adr/0005-bgg-adapter-and-bridge.md) (one adapter, switch to the official API
when the token is there). Look and feel: [docs/design.md](../../docs/design.md) v2.3.0.

**Goal**: the app now has an official BoardGameGeek access token. Game data comes through the
official, permitted way, and people can finally find any game by its name instead of pasting a link.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a game by its name (Priority: P1)

In the menu's **Search** place, the user types part of a game's name. Matching BoardGameGeek games
appear as a list: cover, name, year, and whether it is an expansion. Tapping one opens its details
(cover that opens the images, the same info box as elsewhere, description) and lets the user put it
into one or more collections, optionally with a category, as from a BGG list.

**Why this priority**: the most asked-for gap since the first release; today a game not on any list
can only be added by finding and pasting its link.

**Independent Test**: open Search, type "cascad": Cascadia and its expansions are listed; tap
Cascadia, tick "Essen 2026", choose Must Have, Done: the game is in Essen 2026 as Must Have.

**Acceptance Scenarios**:

1. **Given** the Search place, **When** the user opens it, **Then** the search field is ready to type in, with the hint "Type at least 2 letters."; the screen has no action bar (the search field is the only search control; Enter searches at once).
2. **Given** the user types at least 2 characters and pauses, **When** the search runs, **Then** up to 50 matching games show with cover (or initials), name, year, an "Expansion" mark where it applies, and games already in one of the user's collections say so ("in Essen 2026"); exact name matches come first.
3. **Given** results, **When** the user taps one, **Then** its details sheet opens with the cover (tap: image viewer), name, year, publisher, the info box (players, ratings, designers, mechanisms) and description, plus the collection ticks and the optional category, as in a BGG list's game sheet.
4. **Given** the details sheet, **When** the user ticks collections and presses Done, **Then** the game is added to them (with the chosen category, or No category yet) and a toast confirms it; collections it is unticked from lose it, as in a BGG list.
5. **Given** a search with no match, **When** it finishes, **Then** the screen says "No game called “…” on BoardGameGeek" and suggests checking the spelling.
6. **Given** the user is offline or BoardGameGeek is busy, **When** a search would run, **Then** a clear one-line message says so and offers to try again; nothing else breaks.
7. **Given** the user changes the search text, **When** an older search answers after a newer one, **Then** only the newest search's results are shown.

---

### User Story 2 - Game data comes the official way (Priority: P1)

With the token in place, everything BoardGameGeek's official API offers is read through it: game
details (players, designers, mechanisms, publisher, description, cover, year), ratings and geek
ratings, and geeklists. People notice no change in what they see; the app just stops relying on
BoardGameGeek's website data for these. Data the official API does not offer (the SPIEL preview
lists and the image gallery) keeps coming from where it comes today.

**Why this priority**: required by the project rules (constitution V) as soon as the token exists,
and the basis for search.

**Independent Test**: open a game that the app has not loaded before: its details and ratings appear
as usual, and the server's record shows they were read through the official API; open the SPIEL
preview: it loads as before.

**Acceptance Scenarios**:

1. **Given** the token is configured, **When** game details or ratings are needed, **Then** they are read through the official API, in one request per batch of games, and look exactly as before (same info box, same rounding of ratings).
2. **Given** the token is configured, **When** a geeklist is loaded or resynced, **Then** its games, positions and descriptions come through the official API, and booths, prices and publishers the list mentions are kept as today.
3. **Given** the token is configured, **When** the SPIEL preview or a game's image gallery is opened, **Then** they load as today (the official API offers neither).
4. **Given** no token is configured (e.g. local development), **When** the app runs, **Then** it behaves exactly as before this feature, and Search shows that it is not available.
5. **Given** the token is rejected by BoardGameGeek (expired or revoked), **When** data is needed, **Then** the user sees the usual "BoardGameGeek is not reachable" message, and the server records the reason so the owner can renew the token; games already on the phone stay usable.
6. **Given** games cached before this feature, **When** they are next refreshed, **Then** they are refreshed through the official API; nothing has to be deleted or migrated by hand.

---

### User Story 3 - Add a game by name in a collection (Priority: P2)

The collection's **Add game** sheet, which today asks for a BoardGameGeek link, also lets the user
search by name: typing a name shows matching games; picking one fills the game in, and the user adds
it with an optional category as today. Pasting a link keeps working.

**Why this priority**: most games are added from inside a collection; search there saves leaving the
collection for the Search place.

**Independent Test**: in Essen 2026, Add game, type "harmon", pick Harmonies, choose Interested, Add
to collection: Harmonies is in Essen 2026 as Interested.

**Acceptance Scenarios**:

1. **Given** the Add game sheet, **When** the user types a name (not a link), **Then** up to 8 matching games show below the field; picking one shows it as the recognised game with its cover and editable name, as a pasted link does today.
2. **Given** the user pastes a BoardGameGeek link, **When** it is recognised, **Then** the sheet behaves exactly as today.
3. **Given** a picked game already in this collection, **When** it is shown, **Then** the sheet says so and the add action is disabled, as today.

---

### Edge Cases

- Search text of 1 character, only spaces or over 100 characters: no search runs; a hint says what is needed.
- The user types quickly: a search runs only after a short pause, and identical searches within a while are answered from the cache, so typing does not flood BoardGameGeek.
- Names with accents or other scripts ("Café", "Tôkaidô", Japanese titles): found as BoardGameGeek finds them; the shown name is BoardGameGeek's primary name.
- A result that BoardGameGeek reports without year or cover: shown with "Year unknown" and initials.
- A game that is not a board game or expansion (e.g. an accessory or RPG item): not shown.
- BoardGameGeek asks the app to wait (rate limit or "try again later" answers): the request is retried after the wait it asks for, within the app's one-request-per-second limit; the user sees a waiting state, not an error, unless it takes too long.
- The token is missing on the server but present locally (or the other way round): Search follows the server; the app never needs or sees the token.
- A search started offline is not queued; the user retries when online.

## Requirements *(mandatory)*

### Functional Requirements

**Official data**

- **FR-001**: When the server has a BoardGameGeek token, every kind of data the official API offers (game details incl. ratings, geeklists, search) MUST be read through the official API; no request for that data MAY go to BoardGameGeek's website data any more.
- **FR-002**: Data the official API does not offer (SPIEL preview lists, image galleries) MUST keep using today's source under the constitution's time-limited exception (until 2027-01-31 at the latest).
- **FR-003**: Without a token, the app MUST behave as before this feature; the switch MUST need no change on the phones (a server setting only).
- **FR-004**: The token MUST live only on the server as a secret; it MUST NOT reach the browser, the repository, logs or error messages.
- **FR-005**: All official API use MUST keep the existing rules: server-side only, honest app identification, caching (game data 7 days, searches at least 1 day), at most one request per second, data loaded only when a person needs it.
- **FR-006**: Game details read through the official API MUST show the same fields, order and rounding as today (players, rating, geek rating, booth, edition, designers, mechanisms, publisher, description, cover, year).
- **FR-007**: A rejected token MUST be reported to the person as "BoardGameGeek is not reachable" with retry, and recorded on the server with its reason; it MUST NOT fall back to website data for data the official API offers.

**Search**

- **FR-008**: The Search place MUST offer a search field and search BoardGameGeek by name when the server has a token; without one it MUST keep today's "comes soon" note. In both cases the Search place has no main button or action bar.
- **FR-009**: A search MUST run for 2–100 characters after a short pause in typing (about half a second), return at most 50 board games and expansions, exact name matches first, and mark expansions.
- **FR-010**: Each result MUST show cover or initials, name, year (or "Year unknown"), "Expansion" where it applies, and the user's collections that already hold it.
- **FR-011**: Tapping a result MUST open a details sheet with the image viewer on the cover, the info box, the description, the collection ticks and the optional category, adding and removing exactly as a BGG list's game sheet does (with no booth or price, as search knows none).
- **FR-012**: Only the newest search's results MUST be shown; offline or with BoardGameGeek busy the screen MUST say so with a retry.
- **FR-013**: The collection's Add game sheet MUST accept a game name as well as a link: a name shows up to 8 matches to pick from; a picked game behaves like a recognised link.

**Cross-cutting**

- **FR-014**: New screens and states MUST follow the design rules (search field with the thumb-sized clear ×, rows, sheets, empty and error states) and be accessible: results are a list of buttons named "<game>, <year>[, expansion]", the result count is announced.

### Key Entities

- **BoardGameGeek access**: the server's token and which source answers which kind of data (official API: game details, ratings, geeklists, search; website data: previews, image galleries).
- **Search result**: a game's BoardGameGeek id, primary name, year, kind (board game or expansion), cover; cached per search text.
- **Game** (existing): unchanged in content; now refreshed through the official API.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person finds and adds a named game to a collection from Search in under 30 seconds and at most 5 taps after typing.
- **SC-002**: Search results appear within 2 seconds for 95% of searches (within 0.5 seconds when the same search was made in the last day).
- **SC-003**: With the token configured, 0 requests for game details, ratings or geeklists go to BoardGameGeek's website data (checked in the server's records over a day of use).
- **SC-004**: Game details look identical before and after the switch for a sample of 20 games (same fields and values, ratings within ±0.05).
- **SC-005**: Typing a 10-letter name quickly causes at most 2 searches at BoardGameGeek.
- **SC-006**: Without a token, every existing test and flow behaves as before.

## Assumptions

- The token is a BoardGameGeek XML API application token, sent by the server with each request; the owner stores it as a server secret (never in chat or the repository).
- Search covers board games and expansions only; accessories, RPGs and video games are out of scope.
- Search results do not carry booth or price (those only come from lists); a game added from search has no facts until the person types them or a list provides them.
- Importing a person's own BoardGameGeek collection, hot lists and plays are out of scope (possible later features).
- Searches are cached on the server for at least a day; results changing on BoardGameGeek within that day are acceptable.
- The SPIEL preview and image galleries stay on today's source until BoardGameGeek offers them officially or until 2027-01-31; replacing them is not part of this feature.
- An ADR updates ADR 0005 if the plan changes how sources are chosen; the constitution needs no change.
