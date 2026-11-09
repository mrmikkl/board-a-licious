# Feature Specification: List Filter

**Feature Branch**: `009-list-filter`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "List filter for BGG lists. The Lists place's lists (status lists, previews, geeklists) get a Filter like shopping lists have, beyond the existing name filter: filter games by mechanisms (e.g. Cooperative), by game length in four ranges (short 0–30 min, middle 31–60 min, long 61–120 min, very long 121 min and longer; the four ranges come from Config and can be changed there), by designer, by rating range (BGG average rating), by geek rating range, by "best for x players" and by "recommended for x players" (BGG's player poll). Several filters combine. Games need their BGG details (mechanisms, playing time, designers, ratings, player poll) for this; read them through the official API as the app already does for game details, respecting BGG's throttle and caching. Owner request from the F008 walkthrough (2026-11-08)."

Product context: [docs/vision.md](../../docs/vision.md). Builds on features
[001](../001-bgg-game-collection/spec.md) (BGG lists), [005](../005-essen-feedback/spec.md) (the
shopping lists' "Filter and group" sheet), [006](../006-bgg-xml-search/spec.md) (game details from
BoardGameGeek's official API: designers, mechanisms, ratings, player poll) and
[008](../008-bgg-collection-status/spec.md) (the Lists place with status lists, the name filter).
Rules: [constitution](../../.specify/memory/constitution.md) principle V (respectful BoardGameGeek
integration), [ADR 0007](../../docs/adr/0007-bgg-source-per-kind-of-data.md). Look and feel:
[docs/design.md](../../docs/design.md).

**Goal**: a long list (a SPIEL preview with hundreds of games, a friend's wishlist, one's own
Owned) becomes useful when it can be narrowed to what fits the evening or the group: "cooperative,
under an hour, best with 3, rated 7.5 or more". Today a BGG list can only be filtered by name, and a shopping list only by
category, bought, price and BGG status.

## Terms

| Term | Meaning |
|---|---|
| **BGG list** | a list in the Lists place: a status list (own or a friend's), a preview or a geeklist |
| **Game length** | BoardGameGeek's playing time of a game, in minutes |
| **Length ranges** | four named ranges of game length (Short, Middle, Long, Very long) whose limits the person sets in Config |
| **Best with n** / **Recommended with n** | BoardGameGeek's player poll for n players: most voters call it Best, or (not best) Recommended |
| **Rating** / **Geek rating** | BoardGameGeek's average rating and its Bayes average, 0–10 |

## Clarifications

### Session 2026-11-08

- Q: Which lists get the new filter? → A: the BGG lists in the Lists place (status lists, previews, geeklists) **and** the shopping lists: their "Filter and group" sheet gains the same new sections.
- Q: With several mechanisms (or designers) ticked, must a game have all of them or any one? → A: all ticked: each tick narrows the list.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter a BGG list by what the game is like (Priority: P1)

In a BGG list the person opens **Filter** and narrows the games by mechanisms (e.g. Cooperative
Game), designers, game length ranges and BGG's player poll (best or recommended for a number of
players). The list shows only the matching games and how many of how many match.

**Why this priority**: it is the request: picking what to play or buy from a long list by the kind
of game, length and group size.

**Independent Test**: open a preview with 30 games, Filter › Mechanisms "Cooperative Game" and
Length "Middle": only cooperative games of 31–60 minutes remain, the count reads "4 of 30 games".

**Acceptance Scenarios**:

1. **Given** a BGG list, **When** the person opens Filter, **Then** a sheet shows the sections
   Length, Players (Best for / Recommended for), Rating, Geek rating, Mechanisms and Designers, each
   offering only values found in this list's games, with how many games each value has.
2. **Given** the Filter sheet, **When** the person ticks "Cooperative Game" under Mechanisms,
   **Then** the list at once shows only games with that mechanism and the count "n of N games".
3. **Given** Length with the defaults, **When** the person ticks Short and Middle, **Then** games of
   0–60 minutes remain; games without a known length do not.
4. **Given** Players, **When** the person picks 4, **Then** games that are best or recommended with
   4 players remain (both kinds ticked by default); **When** they untick Recommended, only games best
   with 4 remain; tapping 4 again shows every game.
5. **Given** several sections set, **Then** a game must match every set section (Length and Players
   and Mechanisms …); inside Length several ticked ranges widen the choice.
6. **Given** a filter is set, **Then** the Filter action shows it is active, the name filter still
   works on top, and **Clear filters** brings back the whole list.
7. **Given** the person leaves the list and comes back (also after a reload), **Then** the list's
   filter is still set.

---

### User Story 2 - Filter by rating ranges (Priority: P2)

The person narrows a list to well-rated games: Rating from 7.5, Geek rating between 6.5 and 8.

**Why this priority**: useful on its own, but the kind of game and the group size come first.

**Independent Test**: set Rating "from 7.5": every remaining game has a rating of at least 7.5.

**Acceptance Scenarios**:

1. **Given** the Filter sheet, **When** the person sets Rating from 7.5 (to 10), **Then** only games
   rated 7.5 or more remain; games without a rating do not.
2. **Given** Geek rating from 6.5 to 8, **Then** only games with a geek rating in that range remain.
3. **Given** a range at its full width (0–10), **Then** it does not filter.

---

### User Story 3 - Set the length ranges in Config (Priority: P2)

In Config the person changes where Short ends, where Middle ends and where Long ends (defaults 30,
60 and 120 minutes); Very long is everything above. All lists use the new ranges.

**Why this priority**: the request names the ranges and that they are set in Config; the defaults
work without it.

**Independent Test**: Config › Game length: Short up to 45; in a list Length › Short now matches a
40-minute game.

**Acceptance Scenarios**:

1. **Given** Config, **Then** a section "Game length" shows the four ranges with their limits
   ("Short 0–30 min, Middle 31–60 min, Long 61–120 min, Very long 121 min and more").
2. **When** the person changes a limit, **Then** the ranges next to it follow (Middle starts one
   minute after Short ends), limits must increase, and **Reset** brings back 30 / 60 / 120.
3. **Given** new limits, **Then** every list's Length section uses them at once and an active Length
   filter keeps the same named ranges.
4. **Given** another device of the same person, **Then** the limits are the same there (like the BGG
   username).

---

### User Story 4 - Details are read for the filter, gently (Priority: P1)

To filter, the app needs every game's details. When a list's filter needs details it does not have,
the app reads them from BoardGameGeek in the background, shows progress, and filters as they arrive.

**Why this priority**: without the details nothing can be filtered; a 300-game preview must not
hammer BoardGameGeek or freeze the screen.

**Independent Test**: open the Filter sheet of a status list with 60 games without details: a line
"Reading game details from BoardGameGeek… 20 of 60" appears, the sections fill as the details
arrive, and a second visit reads nothing again.

**Acceptance Scenarios**:

1. **Given** a list whose games lack details, **When** the person opens Filter, **Then** the app
   reads the missing details in batches, at BoardGameGeek's pace, and shows "Reading game details
   from BoardGameGeek… n of N".
2. **Given** details already on the device, **Then** they are used without asking BoardGameGeek.
3. **Given** the person is offline or BoardGameGeek does not answer, **Then** the filter works on the
   games with details, and one line says how many games are left out because their details are
   missing, with Try again.
4. **Given** a game without a value for a set section (no length, no rating, nobody voted on
   players), **Then** it does not match that section, and the sheet says so ("3 games have no
   length on BoardGameGeek").

### User Story 5 - The same filter in shopping lists (Priority: P2)

A shopping list's "Filter and group" sheet gains the same sections, so "Must Haves that are
cooperative and best for 2" works there too.

**Why this priority**: the owner wants one way of filtering everywhere; shopping lists already have a
filter, so the new sections extend it.

**Independent Test**: in a shopping list, Filter › Mechanisms "Cooperative Game": only cooperative
games remain, together with the existing Category and Bought filters.

**Acceptance Scenarios**:

1. **Given** a shopping list, **When** the person opens "Filter and group", **Then** below the
   existing sections come Length, Players, Rating, Geek rating, Mechanisms and Designers.
2. **Given** a category filter and a mechanism ticked, **Then** a game must match both.
3. **Given** any of the new sections set, **Then** the Filter action shows it is active and Clear
   filters resets the new sections with the old ones.

### Edge Cases

- A list with no details at all and offline: the Filter sheet explains that details are needed and
  offers Try again; the name filter still works.
- Expansions: they have their own details and are filtered like games.
- A friend's status list: filtering works the same (read-only only concerns statuses).
- Length limits that do not increase (e.g. Short 90, Middle 60): the save is refused with a line
  saying the limits must increase.
- Very many mechanisms (100+ in a big preview): the section shows the 10 most common first and
  "Show all"; a search field narrows long lists of mechanisms and designers.
- Swiping (BG-Tinder) a list with a filter set: the swipe uses the whole list (filtering the swipe
  is out of scope).
- A filter set on a list that is reloaded with other games: values no longer present are kept but
  shown with count 0, so the person sees why nothing matches.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every BGG list (own and friends' status lists, previews, geeklists) MUST offer a
  **Filter** action that opens a "Filter" sheet; the name filter stays on the screen.
- **FR-002**: The sheet MUST offer Length (the four ranges, multi-choice), Players (a number n:
  1–6 by a tap, any other number typed in, none = any, and the kinds Best and Recommended,
  both ticked by default: the game must be best or recommended with n players),
  Rating (from–to, 0–10, steps of 0.5), Geek rating (the same), Mechanisms and Designers
  (multi-choice from the values in the list, each with its count).
- **FR-003**: Sections MUST combine with AND; values inside Length MUST combine with OR; values
  inside Mechanisms and Designers MUST combine with AND (a game needs every ticked value).
- **FR-004**: The list MUST update at once on every change and show "n of N games"; **Clear
  filters** (disabled when nothing is set) and **Done** close or reset the sheet.
- **FR-005**: The Filter action MUST show when a filter is active (as in shopping lists).
- **FR-006**: A game without the value a set section needs MUST NOT match it; the sheet MUST say
  how many games lack that value.
- **FR-007**: Each list's filter MUST be remembered on the device per list and survive reloads.
- **FR-008**: Config MUST have a "Game length" section with the three limits (defaults 30, 60, 120
  minutes), increasing, with Reset; the limits MUST follow the person to their other devices.
- **FR-009**: Missing game details MUST be read from BoardGameGeek only when a list's filter needs
  them, in batches through the same official access, pace and caching as all game details; details
  already on the device MUST NOT be read again.
- **FR-010**: Reading details MUST show progress ("n of N") and MUST NOT block the list or the
  sheet; failures leave the games with details filterable and offer Try again.
- **FR-011**: The game length MUST come from BoardGameGeek's playing time of the game.
- **FR-012**: The filter MUST work offline on the details already on the device.
- **FR-013**: The shopping lists' "Filter and group" sheet MUST gain the same sections (Length,
  Players, Rating, Geek rating, Mechanisms, Designers) after its existing ones, with the same rules;
  its existing filters (Bought, Price, BGG status, Categories) and grouping stay as they are.

### Key Entities

- **List filter**: per BGG list and device: length ranges ticked, players choice (mode and n),
  rating range, geek rating range, mechanisms ticked, designers ticked.
- **Length limits**: three increasing minute values per person (synced), defining Short, Middle,
  Long, Very long.
- **Game details** (exists, F006): gains the playing time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a 100-game list with details on the device, a change in the Filter sheet shows the
  new result in under half a second.
- **SC-002**: Reading the details of a 300-game preview for the first time finishes within the time
  BoardGameGeek's pace allows (about one request per second for up to 20 games), and the same list
  never causes a second read while the details are on the device.
- **SC-003**: The owner narrows the SPIEL preview to "cooperative, 31–60 min, best for 3" in under
  30 seconds from opening the list.
- **SC-004**: Every filter value shown in the sheet has a correct count of matching games in the
  list (checked against a known test list).

## Assumptions

- "Best for n" uses BGG's player poll: n is best when more voters call it Best than any other
  answer for that count; "Recommended for n" matches when Best plus Recommended outnumber Not
  recommended for n (BGG's own rule for its summary).
- Game length is BoardGameGeek's single "playing time" value; a game's minimum and maximum time are
  not used.
- Ratings come from the details already shown in the game sheet; their freshness is that of the
  details on the device.
- Previews and geeklists keep their own order; filtering never reorders.
- Swiping a list ignores the filter (out of scope).
- The filter is per device (like the shopping lists' filter); only the length limits sync.
