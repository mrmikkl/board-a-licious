# Feature Specification: Essen Feedback (Categories, Row Actions, Quick Filters, List Resync)

**Feature Branch**: `005-essen-feedback`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "essen-changes i recognize while using the app: the group like
"interested" and "unsure" and so on should be called from now "Category"; in collection the
boardgames have on right side the category as icon - instead reserve the right part for actions
and the border color of the boardgame should represent the category; an action to mark the game as
bought (clicking again removes that; buying comes with the price sheet sliding from the bottom);
an action that opens a sliding sheet with just the categories to quickly change a game's category;
add rating and geek rating to game details; in game details move the category actions above the
meta-info box; add a new category "For later", and lay the hexagons out in a zigzag (1st at the
start of the row, 2nd to its bottom right, 3rd to the top right of the 2nd, …); respect a hall
number alone (like "3") as booth when grouping by booths; below the first line in a collection a
quick filter section and another line: a Booth / Cat toggle for grouping, and "Buy" (Must Have,
Interested, Unsure, not bought); remove the active-filter line at the top, the highlighted filter
action is enough; "Clear filters" in the filter sheet (Bought All, Price All, all categories,
Group by Categories); grouping by booth shows Not interested games when that category is selected,
games without booth in "No booth yet"; a search above a collection's games (like BGG list
details); a Resync in a BGG list's menu: new BGG data fills empty game data, data typed in by hand
that differs from BGG is a conflict, shown at the end with both values to choose from, plus "Use
BGG for all" and "Use own for all"."

Product context: [docs/vision.md](../../docs/vision.md). Builds on features
[001](../001-bgg-game-collection/spec.md) (collections, marks, bought with price, filter, booth
groups, list facts), [003](../003-navigation-rework/spec.md) (action bar, sheets from the bottom,
menu) and [004](../004-show-off-gallery/spec.md) (Show-off groups). Look and feel:
[docs/design.md](../../docs/design.md) v2.1.0.

**Goal**: feedback from using the app on the first day of SPIEL Essen 2026. At the fair, the two
things done most often (buy a game, change its category) take one or two taps straight from the
list; finding a game or the next booth to visit takes one tap or a few letters.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Buy a game or change its category straight from the list (Priority: P1)

In a collection each game row shows its category as the colour of the row's border instead of an
icon on the right. The right side holds two actions: **Buy** and **Category**. Tapping Buy on a game
not yet bought slides up the price sheet (as in the details today); saving marks it bought. Tapping
Buy on a bought game marks it not bought again. Tapping Category slides up a sheet with only the
categories; tapping one sets it and closes the sheet.

**Why this priority**: buying and re-sorting are what happens at every booth; today both need the
details sheet first.

**Independent Test**: in a collection, tap Buy on a not-bought game, enter 25, save: the row shows
bought for €25; tap Buy again: not bought. Tap Category on an Interested game, pick Must Have: the
border turns the Must Have colour and the game moves to the Must Have group.

**Acceptance Scenarios**:

1. **Given** a collection, **When** the user looks at a game row, **Then** the row's border has the colour of the game's category (a neutral border for games without a category), no category icon is shown on the right, and the right side shows a Buy action and a Category action.
2. **Given** a game not bought, **When** the user taps Buy, **Then** the price sheet slides up from the bottom with the price field (currency as today) and saving marks the game bought with that price; saving without a price marks it bought without one; cancelling changes nothing.
3. **Given** a bought game, **When** the user taps Buy, **Then** it is marked not bought and the price paid is removed, and a short message says so.
4. **Given** a game row, **When** the user taps Category, **Then** a sheet slides up listing all categories (with emoji and colour, the current one shown as selected); tapping one sets the category, closes the sheet, and the row moves to its new group.
5. **Given** a screen reader, **When** it reaches a row, **Then** the game's name, category and bought state are read, and the two actions are buttons named "Buy <game>" / "Not bought <game>" and "Category of <game>"; the category is never told by colour alone.
6. **Given** no network, **When** the user buys or changes a category from a row, **Then** it works and is synced later, as all changes are today.

---

### User Story 2 - Find the next game at the fair: quick filters, search, halls (Priority: P1)

Below the first line of a collection sits a **quick filter** section, closed by a second line. It has
a **Booth / Cat** toggle (tapping switches between grouping by booth and by category) and a **Buy**
toggle (only Must Have, Interested and Unsure games not bought yet). Above the games there is a
search field that narrows the list by name, as in a BGG list. The line at the top that described
the active filter is gone; the highlighted filter action in the bottom bar is enough. The filter
sheet gets **Clear filters**. Booths given only as a hall ("3") count as that hall when grouping by
booth, and Not interested games show in the booth grouping when their category is selected.

**Why this priority**: walking the halls, the user switches between "what's in this hall" and "what
do I still want" all the time.

**Independent Test**: in a collection, tap Booth: groups by hall, a game with booth "3" sits in
Hall 3; tap Buy: only not-bought Must Have / Interested / Unsure games remain and the filter action
is highlighted; type "cas": only names with "cas" remain; Filter → Clear filters: everything shows
grouped by category.

**Acceptance Scenarios**:

1. **Given** a collection with games, **When** the user looks at it, **Then** below the first line there is a quick filter section with the Booth / Cat toggle and the Buy toggle, followed by a second line, and no line describing the active filter above it.
2. **Given** the collection is grouped by category, **When** the user taps the toggle, **Then** it is grouped by booth (and the toggle shows Booth); tapping again groups by category; the choice is the same setting as "Group by" in the filter sheet and is remembered per collection as today.
3. **Given** any filter, **When** the user turns Buy on, **Then** only games in Must Have, Interested or Unsure that are not bought are shown; turning it off restores the filter in place before; changing the filter in the sheet while Buy is on turns Buy off.
4. **Given** the filter or grouping differs from the default, **When** the user looks at the action bar, **Then** the filter action is highlighted; with the default it is not.
5. **Given** the filter sheet, **When** the user taps Clear filters, **Then** Bought is All, Price is All, all categories are selected and the grouping is by category.
6. **Given** a game with booth "3" (or "Hall 3"), **When** the collection is grouped by booth, **Then** the game is in Hall 3, after the games with a full booth number in that hall; a game with "7-C111 / 3" is in Hall 7 and Hall 3.
7. **Given** Not interested is among the selected categories, **When** the collection is grouped by booth, **Then** Not interested games are shown in their hall (or "No booth yet") like any other; when Not interested is not selected they are not shown.
8. **Given** a collection, **When** the user types into the search above the games, **Then** only games whose name contains the text (ignoring case and accents) are shown, within the current filter and grouping; clearing the search shows them all again; when nothing matches the screen says so.
9. **Given** a collection, **When** the user taps any group's heading (a category, a hall or "No booth yet"), **Then** the group collapses to its heading with its count, and tapping again expands it; at first every group is expanded except For later, Poop and Not interested, which start collapsed.
10. **Given** the filter sheet, **When** the user looks at grouping, **Then** it is called "Group by" with "Categories" and "Booths" (formerly Marks / Halls).

---

### User Story 3 - "For later" category, Category naming and a zigzag picker (Priority: P2)

What the app called marks or groups is called **Category** everywhere. A new category **For later**
holds games the user wants to look at again after the fair. In a game's details the category
hexagons sit above the info box and are laid out in a zigzag: the first at the start of the row,
the second lower right of it, the third upper right of the second, the fourth lower right of the
third, the fifth upper right of the fourth, so they interlock like a honeycomb.

**Why this priority**: useful immediately but not blocking the fair routine of US1 and US2.

**Independent Test**: open a game's details: five category hexagons (Must Have, Interested,
Unsure, For later, Poop) in a zigzag above the info box; tap For later: the game moves to the For
later group of the collection and its border takes the For later colour.

**Acceptance Scenarios**:

1. **Given** any screen, **When** the app speaks of Must Have, Interested, Unsure, For later, Poop, Not interested or the not-yet-sorted games, **Then** it calls them categories ("Category", "Group by Categories", "No category yet"); the words "mark" and "group" for them are gone.
2. **Given** a game's details, **When** they open, **Then** the category picker is directly under the cover, name and bought state, above the info box (price, players, booth, …).
3. **Given** the category picker, **When** it shows, **Then** the five hexagons (Must Have, Interested, Unsure, For later, Poop) sit in one zigzag row, alternating low and high and touching edges, each at least 44 px to tap; Not interested stays a separate action as today.
4. **Given** the new category, **When** it is used, **Then** it has its own emoji and colour and appears in category order after Unsure in every place categories show: collection groups, filter sheet, Category sheet (US1), Show-off, shared text and backups.
5. **Given** a friend's phone still runs an older app version, **When** a game is in For later, **Then** that phone updates to the new version before showing it (no game is lost or shown under a wrong category).

---

### User Story 4 - Rating and geek rating in game details (Priority: P2)

A game's details show BoardGameGeek's average rating and its geek rating.

**Why this priority**: helps decide at the booth; small and independent.

**Independent Test**: open the details of a well-known game: the info box shows "Rating 7.9" and
"Geek rating 7.4" (BGG's values, one decimal).

**Acceptance Scenarios**:

1. **Given** a game whose BoardGameGeek details are known, **When** its details open, **Then** the info box shows Rating (BGG's average) and Geek rating (BGG's ranked rating), each with one decimal, after Players.
2. **Given** a game BoardGameGeek has no rating for yet (no or too few votes), **When** its details open, **Then** the missing value is left out rather than shown as 0.
3. **Given** games added before this feature, **When** their details open, **Then** the ratings show once the game's BGG details are fetched again (as for other details), without the user doing anything.

---

### User Story 5 - Resync a BGG list and settle conflicts (Priority: P3)

In a BGG list's details the menu offers **Resync with BGG**. The app reads the list again from
BoardGameGeek. For each game of the list that is in one of the user's collections: data BGG now has
and the game did not (booth, price, publisher, edition) is filled in; data that came from the list
before is updated as today; data the user typed in by hand that differs from BGG's is a conflict.
At the end a sheet lists all conflicts, each with the game, the field, the own value and BGG's
value to choose from, and offers **Use BGG for all** and **Use own for all**.

**Why this priority**: the SPIEL preview keeps changing during the fair, but resyncing is
occasional and the other stories matter more at the booth.

**Independent Test**: in a collection, a game from the SPIEL preview has a booth typed in by hand
("3") while the preview now says "3-A100", and another game has no price while the preview now has
one; open the preview, Menu → Resync with BGG: the price is filled in silently; a conflicts sheet
shows the booth with "3" and "3-A100"; choose "3-A100": the game now shows Booth 3-A100.

**Acceptance Scenarios**:

1. **Given** a BGG list's details, **When** the user opens the menu, **Then** there is a Resync with BGG entry.
2. **Given** the user taps it and is online, **When** the list has been read again, **Then** for every game of the list in any of the user's collections, empty fields are filled from BGG and list-sourced fields are updated, and a short message says how many games were updated.
3. **Given** a field typed in by hand that differs from BGG's value, **When** the resync ends, **Then** a sheet slides up listing each conflict once per game and field (game name, field, "Own: …", "BGG: …"), with a choice per conflict and the actions Use BGG for all and Use own for all; confirming applies the choices to every collection holding the game.
4. **Given** the conflicts sheet, **When** the user closes it without choosing, **Then** the own values stay and the same conflict is offered again on the next resync.
5. **Given** the user chose the own value, **When** they resync again and BGG's value has not changed, **Then** that conflict is not offered again; if BGG's value changed, it is offered again.
6. **Given** no conflicts, **When** the resync ends, **Then** no conflicts sheet opens.
7. **Given** no network or BoardGameGeek busy, **When** the user taps Resync, **Then** a clear message says so and nothing changes.

---

### User Story 6 - Copy or move a game to another collection (Priority: P2)

A game's details offer, beside **Remove from <collection>**, **Copy to collection** and **Move to
collection**. Each opens a sheet to choose the other collection; copying puts the game in it as
well, moving takes it out of this one.

**Why this priority**: at the fair games shift between lists ("Essen 2026" → "Christmas 2026");
today that means adding the game again by hand and losing its category, booth and price.

**Independent Test**: in Essen 2026, open Harmonies (Must Have, bought for €38), Move to
collection → Christmas 2026 → Move: Harmonies is gone from Essen 2026 and in Christmas 2026 as Must
Have, bought for €38, with its booth.

**Acceptance Scenarios**:

1. **Given** a game's details and at least one other collection, **When** the user looks at the actions, **Then** there are Copy to collection and Move to collection next to each other, above Remove from <collection>.
2. **Given** the user taps either, **When** the sheet opens, **Then** it is titled "Copy <game>" or "Move <game>", has a dropdown of the other collections (those already holding the game are listed as "(already in it)" and cannot be chosen), one line saying what goes along, and Cancel / Copy or Move.
3. **Given** Copy, **When** the user confirms, **Then** the game is added to the chosen collection with its category and facts (booth, price, publisher, edition), not bought there; it stays as it is here; a toast says "Copied <game> to <collection>" and the details stay open.
4. **Given** Move, **When** the user confirms, **Then** the game, with category, facts, bought and price paid, is in the chosen collection and no longer in this one; the details close and a toast says "Moved <game> to <collection>".
5. **Given** every other collection already holds the game, or there is no other collection, **When** the sheet would open, **Then** the actions are still shown and the sheet says so, with the confirm action disabled.
6. **Given** no network, **When** the user copies or moves, **Then** it works and is synced later.

### Edge Cases

- A game is bought from a row while the details sheet of another game is open: not possible, rows sit behind the sheet; only one sheet at a time.
- Tapping Buy twice quickly on a bought game: the second tap acts on the new state (not bought → opens the price sheet), never double-toggles silently.
- Category sheet on a game marked Not interested: lists all categories including Not interested and No category yet, so it can be brought back.
- Search with the Buy quick filter on and grouping by booth: all three narrow together; a game with booths in two halls appears in both.
- Booth text "3" next to a full booth in hall 3 ("3-A100 / 3"): the game appears once in Hall 3.
- Booth text that is neither a booth nor a number (e.g. "Hall foyer"): treated as no booth ("No booth yet") as today.
- The Buy quick filter selected while the filter sheet shows: the sheet shows the categories and Bought as the quick filter set them.
- Resync of a list with hundreds of games: progress is visible and the user can leave the screen; the resync finishes or stops cleanly.
- Resync where the same game sits in two collections with different own values: one conflict per own value, each naming the collection.
- A game whose price was typed in another currency than BGG's: a conflict, both values shown with their currency.
- BGG removed a booth from the list: a list-sourced booth is cleared as today; a typed-in booth stays and is not a conflict.

## Requirements *(mandatory)*

### Functional Requirements

**Naming**

- **FR-001**: The app MUST call the sorting of games (Must Have, Interested, Unsure, For later, Poop, Not interested and the unsorted games) **Category** in every text, heading, label and accessible name; the unsorted ones are "No category yet"; grouping options are "Categories" and "Booths".

**Category "For later"**

- **FR-002**: The app MUST offer a category For later, with its own emoji and colour, ordered after Unsure and before Poop everywhere categories are listed, counted, grouped, shared, backed up or restored.
- **FR-003**: Data with For later MUST sync like any other category; a backup containing For later MUST restore; an older backup without it MUST restore unchanged.

**Game rows**

- **FR-004**: A game row MUST show its category by the colour of its border (neutral for No category yet; Not interested keeps its dimmed look) and MUST NOT show a category icon on the right.
- **FR-005**: The right side of a game row MUST hold a Buy action and a Category action, each at least 44×44 px, without opening the details sheet; tapping elsewhere on the row still opens the details.
- **FR-006**: Buy on a not-bought game MUST open the price sheet from the bottom (price optional, currency as today); saving marks it bought (with the existing "got it" feedback), cancelling changes nothing.
- **FR-007**: Buy on a bought game MUST mark it not bought and remove the price paid, with a short confirmation message.
- **FR-008**: Category MUST open a sheet from the bottom with all categories (emoji, name, colour, current one selected); choosing one sets it and closes the sheet.
- **FR-009**: The bought state MUST remain visible on the row (as today) in addition to the Buy action's state.

**Game details**

- **FR-010**: The details MUST show the category picker above the info box.
- **FR-011**: The picker MUST lay out Must Have, Interested, Unsure, For later and Poop as hexagons in one zigzag row (1st start of the row, 2nd lower right of the 1st, 3rd upper right of the 2nd, 4th lower right of the 3rd, 5th upper right of the 4th), fitting a 360 px wide screen; Not interested stays a separate action.
- **FR-012**: The info box MUST show Rating (BGG average) and Geek rating (BGG's ranked/Bayesian rating) with one decimal, after Players, each left out when BGG has no value.

**Collection screen**

- **FR-013**: Below the first line of a collection the app MUST show a quick filter section followed by a second line; it MUST NOT show the line describing the active filter.
- **FR-014**: The quick filter section MUST have a toggle labelled Booth / Cat that switches the grouping between booths and categories (the same setting as in the filter sheet, remembered per collection).
- **FR-015**: The quick filter section MUST have a Buy toggle that, when on, shows only games in Must Have, Interested or Unsure that are not bought; turning it off restores the filter before; any change in the filter sheet turns it off.
- **FR-016**: The filter action in the action bar MUST be highlighted whenever filter or grouping differ from the default (all categories, Bought All, Price All, by categories), including when Buy is on.
- **FR-017**: The filter sheet MUST offer Clear filters, which sets the default: Bought All, Price All, all categories selected, Group by Categories.
- **FR-018a**: Every group heading in a collection (each category, each hall, "No booth yet") MUST collapse and expand its games on tap, keeping its count visible; all groups start expanded except For later, Poop and Not interested, which start collapsed; folding is not remembered between visits.
- **FR-018**: A collection MUST have a search field above its games that narrows the shown games by name (case- and accent-insensitive, on top of filter and grouping); the search is not remembered when leaving the collection; with no match the screen says so and offers to clear the search.

**Booths**

- **FR-019**: When grouping by booth, a booth part that is only a hall number ("3", or "Hall 3") MUST count as that hall; such games come after the games with full booths in that hall, then by name.
- **FR-020**: Grouping by booth MUST show exactly the games the filter lets through, including Not interested when that category is selected; games without a booth go to "No booth yet".

**Resync a BGG list**

- **FR-021**: A BGG list's details MUST offer Resync with BGG in its menu; it reads the list again from BoardGameGeek through the app's existing cached, rate-limited access, and works only online.
- **FR-022**: For each game of the list in any of the user's collections, the resync MUST fill each empty field (booth, price with currency, publisher, edition) from BGG, update fields that came from a list as today, and leave equal values unchanged.
- **FR-023**: A field typed in by hand whose value differs from BGG's MUST be collected as a conflict (per game, field and own value) and not changed during the resync.
- **FR-024**: After the resync, when there are conflicts, a sheet MUST list them with game name, field, own value and BGG value, a choice per conflict, and Use BGG for all and Use own for all; applying writes the chosen values (a BGG value counts as coming from the list from then on).
- **FR-025**: A conflict settled with the own value MUST NOT be offered again until BGG's value for that field changes; a sheet closed without applying keeps own values and offers the conflicts again next time.
- **FR-026**: The resync MUST report its result in one short message (games updated, conflicts found) and, when offline or BGG is busy, say so without changing anything.

**Copy and move**

- **FR-026a**: A game's details MUST offer Copy to collection and Move to collection besides Remove from <collection>; each opens a sheet with a dropdown of the person's other collections, those already holding the game shown as "(already in it)" and not selectable, and Cancel / Copy or Move (disabled while nothing can be chosen).
- **FR-026b**: Copy MUST add the game to the chosen collection with its category and facts (booth, price, publisher, edition and their source), not bought, and leave this collection unchanged.
- **FR-026c**: Move MUST put the game into the chosen collection with category, facts, bought and price paid, and remove it from this collection, as one change that syncs like any other and works offline.

**Cross-cutting**

- **FR-027**: All new controls MUST meet the project's accessibility rules: names for screen readers, category never by colour alone, visible focus, reduced motion respected by the sheets.

### Key Entities

- **Category** (formerly mark): how much someone wants a game; one of No category yet, Must Have, Interested, Unsure, For later, Poop, Not interested; each with emoji, colour and order.
- **Entry** (a game in a collection): category, bought with price paid, facts (booth, price, publisher, edition) with their source (from a list or typed in).
- **Game details** (from BoardGameGeek): now also rating and geek rating.
- **Quick filter state** (per collection, on the device): Buy on/off with the filter it replaced; the grouping (booths / categories) is the existing setting.
- **Resync conflict**: game, field, own value, BGG value, collections affected; settled conflicts remember the BGG value that was declined.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Marking a game in a collection as bought with a price takes at most 3 taps plus typing the price, without opening the details (today: at least 4).
- **SC-002**: Changing a game's category from the collection takes 2 taps.
- **SC-003**: Switching a collection between booth and category grouping takes 1 tap; showing only the games still to buy takes 1 tap.
- **SC-004**: Finding a named game in a collection of 200 games takes under 5 seconds by typing at most 4 letters.
- **SC-005**: Every game with a booth given as a hall number only appears in that hall's group (0 such games under "No booth yet").
- **SC-006**: A resync of the SPIEL preview with conflicts lets the user settle all of them in 1 tap (Use BGG for all / Use own for all).
- **SC-007**: In the friend group's use at the fair, nobody needs to open a game's details just to buy it or change its category.

## Assumptions

- **For later** sits after Unsure and before Poop; its emoji (e.g. ⏳) and colour are set in the design step; it is not part of the Buy quick filter (the user listed Must Have, Interested and Unsure).
- "Not yet marked" becomes "No category yet"; internal names may stay as they are.
- Removing "bought" from a row needs no confirmation; the message is enough (it can be bought again in two taps). The price paid is dropped with it.
- The Category sheet lists all seven categories, so Not interested and No category yet can be set from the row too.
- The search sits in the quick filter section, right below the toggles and above its closing line; it searches names only.
- The Booth / Cat toggle shows the grouping it switches to or the current one — decided in the design step.
- Hall-only booths are a plain number or "Hall <number>"; other text without a booth number stays "No booth yet".
- Resync covers the four list fields (booth, price, publisher, edition) for games in any of the user's collections; BGG game details (players, designers, ratings) refresh as today and never conflict.
- Rating and geek rating come with the game details already fetched from BoardGameGeek; no extra BGG requests per game.
- The PWA updates itself on the friends' phones as today, so the new category is understood everywhere after the update.
- Today's date is the first day of SPIEL Essen 2026; the stories are ordered so US1 and US2 can ship first.
