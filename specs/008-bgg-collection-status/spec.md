# Feature Specification: BGG Statuses, Buy and Lists

**Feature Branch**: `008-bgg-collection-status`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "BGG collection statuses (Own, Previously owned, For trade, Want in trade, Want to buy, Want to play, Preordered, Wishlist with priority): show them as BGG lists, show a game's statuses as badges, change them in the app and write the change to BoardGameGeek using the user's own BGG login, kept only in their browser." Extended the same day: "Collections are about buying: Buy gets the tabs Search and Shopping lists (today's collections). The BGG lists place becomes Lists with the tabs Status lists, Previews and Geeklists; friends' status lists land there too. Hitting buy should update my BGG collection."

Product context: [docs/vision.md](../../docs/vision.md). Builds on features
[001](../001-bgg-game-collection/spec.md) (collections, BGG lists, swipe),
[003](../003-navigation-rework/spec.md) (menu and places), [007](../007-buy-prices/spec.md) (the Buy place and prices) and
[006](../006-bgg-xml-search/spec.md) (official BoardGameGeek API with the app's token). Rules:
[constitution](../../.specify/memory/constitution.md) principle V (respectful BoardGameGeek
integration) and [ADR 0007](../../docs/adr/0007-bgg-source-per-kind-of-data.md) (source per kind of
data). Look and feel: [docs/design.md](../../docs/design.md).

**Goal**: what people already keep on BoardGameGeek (what they own, wish for, want to play or trade)
shows up in the app, so at the fair they see at a glance what they already have, can build
shopping lists from it, and can update BoardGameGeek right where they decide, without switching to
the BoardGameGeek website. The menu is reorganised around the two things people do: **buy** (find a
game, plan in shopping lists, tick it off) and **browse lists** (status lists, previews, geeklists).

## Terms

| Term in this spec | Today's name | Meaning |
|---|---|---|
| **Shopping list** | collection | the app's own curated list of games with categories (Must Have, Interested, …), bought ticks and prices; code and database keep the name "collection" |
| **Lists** (place) | BGG lists | where lists from BoardGameGeek are browsed, swiped and used to fill shopping lists |
| **Status list** | (new) | all games with one BoardGameGeek status (Owned, Wishlist, …) in one person's BoardGameGeek collection |

## Background: statuses on BoardGameGeek

On BoardGameGeek every game in a person's collection carries status flags: **Own**, **Previously
owned**, **For trade**, **Want in trade**, **Want to buy**, **Want to play**, **Preordered** and
**Wishlist** (with a priority from 1 "Must have" to 5 "Don't buy this"). Several can be set at once
(Own + For trade). A status is not a shopping list: a shopping list is a curated container with
categories, bought ticks and prices; a status is a fact BoardGameGeek keeps about one game. The app
therefore treats statuses as a **source** (status lists in Lists) and as **badges** on games, never
as a second copy to keep in sync.

## User Scenarios & Testing *(mandatory)*

### User Story 0 - Two places: Buy and Lists (Priority: P1)

The menu holds three places: **Buy**, **Lists** and **Config**. Buy has two tabs: **Search** (today's
Buy: find a game by name and see its prices; each result also has the + to put it into shopping
lists) and **Shopping lists** (today's Collections, unchanged inside). Lists has three tabs:
**Status lists**, **Previews** and **Geeklists** (today's BGG lists, split by kind). The separate
Search place goes away; its job is done by Buy › Search.

**Why this priority**: it gives status lists their home and puts buying at the centre, which is how
the app was used at SPIEL.

**Independent Test**: open the menu: Buy, Lists, Config; open Buy: tabs Search and Shopping lists;
open Shopping lists: "Essen 2026" is there as before; open Lists › Previews: the SPIEL preview is
there; Lists › Geeklists: the loaded geeklists.

**Acceptance Scenarios**:

1. **Given** the menu, **When** the user opens it, **Then** it lists Buy, Lists and Config, with the current place marked; there is no Collections, BGG lists or Search entry.
2. **Given** Buy, **When** it opens, **Then** two tabs show, Search and Shopping lists; the tab used last on this device is selected (Search the first time).
3. **Given** Buy › Search, **When** the user taps a result, **Then** the game's sheet opens with everything about the game: cover, info box, description, the folded Prices section, "Bought it", "Add to shopping lists" and the BGG status; there is no separate price screen any more. Each result row has an **Add** action inside the row (like Buy and Category in a shopping list's rows) to put the game into shopping lists.
9. **Given** any game row outside a shopping list (search results, previews, geeklists, status lists), **When** it is shown, **Then** its only row action is **Add**, inside the row; the Category action and the category picker exist only in shopping lists.
4. **Given** Buy › Shopping lists, **When** it opens, **Then** it shows what Collections shows today (cards, create, open, share, buy ticks), with "collection" called "shopping list" in all visible text.
5. **Given** Lists, **When** it opens, **Then** three tabs show in the order Status lists, Previews, Geeklists; the tab used last on this device is selected (Status lists the first time).
6. **Given** Lists › Previews or Geeklists, **When** they open, **Then** they show the loaded lists of that kind as BGG lists does today; the plus (load by link) is available on every tab and puts a pasted list into the tab of its kind.
7. **Given** an old link or bookmark to Collections, BGG lists or Search, **When** it is opened, **Then** the matching new place and tab open.
8. **Given** a shopping list, **When** the user taps the heart to swipe, **Then** the list choice offers status lists, previews and geeklists, grouped like the Lists tabs.

### User Story 1 - My BGG statuses as status lists (Priority: P1)

In Config the user enters their BoardGameGeek username once. From then on Lists › Status lists shows
their status lists: "Owned", "Wishlist", "Want to play",
"For trade", "Want in trade", "Want to buy", "Preordered", "Previously owned", each with its number
of games. A status list opens and works like any other BGG list: game rows, game info, adding to one
or more shopping lists with a category, and swiping through it into a shopping list. Just opening
Owned to look something up is the common case. Friends' status lists, loaded by link, show below the
user's own, grouped by person.

**Why this priority**: reading is permitted through the official API without any login, it is the
basis for badges and editing, and on its own it already answers "do I own this?".

**Independent Test**: in Config enter username "mrmikkl"; go to Lists › Status lists: the status
lists appear with counts; open "Wishlist": its games show with cover and name; swipe it into a new
shopping list "Wishes": the right-swiped games are in "Wishes".

**Acceptance Scenarios**:

1. **Given** no BGG username in Config, **When** the user opens Lists › Status lists, **Then** one hint shows, "Add your BGG username in Config to see what you own, wish for and want to play" leading to Config.
2. **Given** a username, **When** the user opens Status lists, **Then** a group "Mine (mrmikkl)" lists every status that has at least one game, with its count; statuses without games are left out; below it, one group per friend whose status list was loaded by link ("anna: Wishlist").
3. **Given** a status list, **When** the user opens it, **Then** it shows its games like a geeklist (cover, name, year, which shopping lists they are in), and every action of a BGG list works: game info, add to shopping lists with a category, swipe into a shopping list.
4. **Given** the Wishlist, **When** it is shown, **Then** games are grouped by priority (1 Must have … 5 Don't buy this), each game showing its priority.
5. **Given** BoardGameGeek is still preparing the collection (it does this for collections not asked for recently), **When** the user opens a status list, **Then** the app says "BoardGameGeek is preparing your collection…" and loads it on its own as soon as it is ready, without the user doing anything.
6. **Given** an unknown username, **When** the lists load, **Then** the app says "No BoardGameGeek user called “…”" and links to Config.
7. **Given** the user is offline, **When** they open a status list loaded before, **Then** the last loaded version shows with the time it was loaded.
8. **Given** a pulled-down list or the refresh action, **When** the user refreshes, **Then** the statuses are read again from BoardGameGeek.

---

### User Story 2 - See a game's statuses everywhere (Priority: P1)

Wherever a game is shown (shopping list rows, BGG list rows, search results, game sheet, swipe card),
small badges say what the user's BoardGameGeek collection says about it: "Owned", "Wishlist 1",
"Want to play", "For trade", and so on. At the fair, swiping through the SPIEL preview, the user sees
immediately that they already own a game or have it on their wishlist.

**Why this priority**: the single most useful piece of information at the fair ("I already have
this"), and it needs nothing but reading.

**Independent Test**: with username "mrmikkl" set and a game the user owns in a shopping list, open
that shopping list: the game's row shows an "Owned" badge; open the SPIEL preview and swipe to that
game: the card shows "Owned".

**Acceptance Scenarios**:

1. **Given** a username and a game with the status Own, **When** the game is shown in a list row, card or sheet, **Then** it carries an "Owned" badge in text (not only a colour or icon).
2. **Given** a game with several statuses, **When** it is shown in a row, **Then** at most two badges show in a fixed order of importance (Owned, Preordered, Wishlist n, Want to play, For trade, Want in trade, Want to buy, Previously owned) plus "+n" for the rest; the game sheet shows all of them.
3. **Given** a game with no status or no username set, **When** it is shown, **Then** no badge and no empty space appear.
4. **Given** a filter in a shopping list, **When** the user filters, **Then** they can also filter by BGG status (e.g. hide games I own).

---

### User Story 3 - Sign in to BoardGameGeek on this device (Priority: P2)

To change statuses the app needs to act as the user on BoardGameGeek. In Config the user signs in
with their BoardGameGeek username and password. The app uses the password once to sign in, keeps only
the resulting BoardGameGeek session on this device and forgets the password. Config then shows
"Signed in to BoardGameGeek as mrmikkl on this device" and a "Sign out" button. On another device, or
after signing out, the user signs in again.

**Why this priority**: the precondition for writing (US4); separate because it carries the security
promises.

**Independent Test**: in Config sign in with valid BGG credentials: the signed-in line appears;
reload the app: still signed in; open the app on a second device: not signed in there; sign out:
the line is gone and editing statuses asks for sign-in again.

**Acceptance Scenarios**:

1. **Given** Config, **When** the user opens the BoardGameGeek section, **Then** it explains in one or two sentences what signing in allows, that the password is not kept, and that the sign-in stays on this device only.
2. **Given** valid credentials, **When** the user signs in, **Then** the app signs in to BoardGameGeek, keeps only the session on this device, never keeps the password, and shows the signed-in line; the BGG username for reading (US1) is set to the same name if it was empty.
3. **Given** wrong credentials, **When** the user signs in, **Then** the app says "BoardGameGeek did not accept this username or password" and keeps nothing.
4. **Given** a signed-in device, **When** the user signs out, **Then** the session is removed from the device at once.
5. **Given** a signed-in device, **When** another person signs in to the app on the same browser (different app account), **Then** they are not signed in to BoardGameGeek with the first person's session.
6. **Given** a BoardGameGeek session that has expired or was ended on BoardGameGeek, **When** the app next uses it, **Then** it removes it and asks the user to sign in again, keeping the change they were making.

---

### User Story 4 - Change a game's statuses and write them to BoardGameGeek (Priority: P2)

In a game's sheet, a "BGG status" section shows the statuses as toggles (Own, Want to play, Wishlist
with priority, For trade, Want in trade, Want to buy, Preordered, Previously owned). When the user
changes them and confirms, the change is written to their BoardGameGeek collection; badges and status
lists update. A game not yet in their BoardGameGeek collection is added to it.

**Why this priority**: the full loop (decide in the app, BoardGameGeek follows) but it depends on
US3 and on BoardGameGeek accepting the change, so it comes after reading.

**Independent Test**: signed in, open a game the user does not own, tick Own, Save: within seconds
the game shows "Owned", appears in the Owned status list, and the BoardGameGeek website shows it as
owned.

**Acceptance Scenarios**:

1. **Given** a game sheet and a username, **When** the user looks at it, **Then** a "BGG status" section shows the game's current statuses; when not signed in, the toggles are shown but changing them first asks to sign in (US3).
2. **Given** a signed-in user, **When** they change one or more statuses and save, **Then** the change is written to BoardGameGeek, a toast confirms "Saved on BoardGameGeek", and badges and status lists show the new state.
3. **Given** Wishlist is switched on, **When** the user saves, **Then** a priority (1–5) is required, defaulting to 3 "Like to have".
4. **Given** a change BoardGameGeek rejects or cannot be reached, **When** the user saves, **Then** nothing is shown as changed, the app says what went wrong in one line and offers to try again; the user's choices stay in the sheet.
5. **Given** the user is offline, **When** they open the BGG status section, **Then** it says changes need a connection and the toggles are disabled.
6. **Given** a game whose statuses were changed on the BoardGameGeek website since the app last read them, **When** the user saves, **Then** only the statuses the user changed in the app are changed on BoardGameGeek; others keep what BoardGameGeek has.
7. **Given** all statuses switched off, **When** the user saves, **Then** the game stays in their BoardGameGeek collection without status (as BoardGameGeek itself does); the app does not delete collection entries.

---

### Clarifications

#### Session 2026-11-08

- Q: How fresh must statuses be? → A: re-read when opened and older than 1 hour, plus manual refresh.
- Q: Are friends' status lists in scope? → A: yes, by pasting their BGG collection link; read-only, no badges.
- Q: Does ticking a game as bought touch BoardGameGeek? → A: the app offers "Also mark as owned on BoardGameGeek?"; one tap writes it.
- Q: How is the menu organised? → A: Buy (tabs Search, Shopping lists), Lists (tabs Status lists, Previews, Geeklists), Config; the Search place is folded into Buy › Search; "collections" are called "shopping lists".
- Q: Does buying from Search need a shopping list? → A: no; BoardGameGeek's Owned is the record. Selling (For trade → no longer owned) is a later feature.
- Q: What does tapping a search result open? → A: the game's full sheet (info, Prices, Bought it, Add, BGG status); the price screen goes.
- Q: Badge colours? → A: one colour per status, configurable in Config.
- Q: How is the category shown in a shopping list's game sheet? → A: a folded "Category" section with the same list as the Category action, no hexagon picker.
- Q: Where do statuses sit in the game sheet? → A: badges next to the cover; switches in a folded "BGG status" section below Prices (variant A).
- Q: Category outside shopping lists? → A: no; rows elsewhere have only Add, inside the row.
- Q: Does the price paid go to BoardGameGeek? → A: yes, into the game's private info: price paid with currency, acquisition date and acquired from (booth or shop); an existing price paid is only replaced after asking.

### User Story 5 - Buying updates BoardGameGeek (Priority: P2)

Buying is the main action. When the user ticks a game as bought, in a shopping list or straight from
Buy › Search (a game's sheet), the app offers to mark it as owned on BoardGameGeek. Buying
from Search no longer needs a shopping list: the game's Owned status on BoardGameGeek is the record.

**Why this priority**: it removes the chore of adding every bought game to the BoardGameGeek
collection afterwards; it needs US3 (sign-in) and the writing of US4.

**Independent Test**: signed in, open Buy › Search, find a game not owned, open its sheet, tap
"Bought it", confirm "Also mark as owned on BoardGameGeek?": the game shows "Owned" and is in the Owned
status list.

**Acceptance Scenarios**:

1. **Given** a game's sheet opened from Buy › Search or a list, **When** the user looks at it, **Then** a "Bought it" action is there next to "Add to shopping lists".
2. **Given** a game not owned on BoardGameGeek, **When** the user ticks it as bought (in a shopping list or on the prices screen), **Then** the app asks "Also mark as owned on BoardGameGeek?" with Yes / Not now; Yes writes Own (signing in first if needed), Not now writes nothing.
3. **Given** the question, **When** it shows, **Then** it lists what will be written to the game's private info on BoardGameGeek: price paid with currency (the price entered when buying), acquisition date (the day it was ticked) and acquired from ("SPIEL Essen 2026 · booth 3-A101" when the game has a booth, else the shop of the chosen price offer, else empty); Yes writes Own and these values in one save.
4. **Given** BoardGameGeek already has a price paid for the game, **When** the user confirms, **Then** the app asks "Replace the price paid on BoardGameGeek (39.99 EUR) with 45.00 EUR?" before writing; No still writes Own but keeps BoardGameGeek's private info.
5. **Given** a game already owned on BoardGameGeek, **When** it is ticked as bought, **Then** the app offers only "Add the price paid on BoardGameGeek?" (same values, same replace rule), or nothing if no price was entered.
6. **Given** "Bought it" in the sheet of a game in no shopping list, **When** the user taps it, **Then** the app asks for the price paid (optional) and the BoardGameGeek question follows; no shopping list is created or changed, and without sign-in or with Not now nothing is recorded (the screen says so).

---

### Edge Cases

- Collections with several hundred games (owned lists of collectors): status lists and badges stay quick; the list scrolls like any long BGG list.
- Expansions: BoardGameGeek keeps them in the collection like games; they show with the existing "Expansion" mark.
- The same game twice in a BoardGameGeek collection (two copies or versions): the game shows once; a status counts if any copy has it; writing changes the first copy.
- The username in Config is changed: status lists and badges switch to the new name; a BoardGameGeek sign-in for another name is signed out.
- BoardGameGeek keeps saying "preparing" for a long time: after about a minute the app stops waiting and offers to try again.
- A status list is used as a swipe source and the user swipes left: as with any BGG list, this only records "Not interested" in the app collection and never changes BoardGameGeek.
- Badges for games the app has never loaded statuses for (no username, or loading failed): no badge, never a wrong one.
- A pasted collection link without a status filter: it opens as the user's whole BoardGameGeek collection (all games with any status).
- A friend's collection that is private or a username that does not exist: the app says so in one line; nothing else breaks.
- Two devices: the user changes a status on one; the other shows the new state after its next refresh of the statuses.

## Requirements *(mandatory)*

### Functional Requirements

**Places and tabs**

- **FR-023**: The menu MUST hold exactly the places Buy, Lists and Config; the Search place is removed and its function is part of Buy › Search.
- **FR-024**: Buy MUST have the tabs Search (feature 006/007's search; a result opens the game's full sheet with Prices, Bought it, Add to shopping lists and BGG status; feature 007's separate price screen is removed) and Shopping lists (everything Collections offers today).
- **FR-032**: Rows of games outside shopping lists MUST carry their Add action inside the row; the Category action and picker MUST appear only in shopping lists.
- **FR-025**: Lists MUST have the tabs Status lists, Previews and Geeklists in this order; a loaded list appears in the tab of its kind.
- **FR-026**: Each place MUST remember its last used tab per device and open on it.
- **FR-027**: All visible text MUST call the app's collections "shopping lists" (e.g. "New shopping list", "Add to shopping lists"); stored data and shared texts keep working unchanged.
- **FR-028**: Links to the old places (Collections, BGG lists, Search) MUST lead to the matching new place and tab.

**Reading statuses**

- **FR-001**: Users MUST be able to set and change their BoardGameGeek username in Config; it is part of their app data and follows them to their other devices.
- **FR-002**: For a set username, Lists › Status lists MUST show one status list per BoardGameGeek status that has games (Owned, Wishlist, Want to play, For trade, Want in trade, Want to buy, Preordered, Previously owned), with counts, as the first group; friends' status lists loaded by link follow, grouped by person.
- **FR-003**: A status list MUST offer everything a BGG list offers (rows, game info, add to shopping lists with category, swipe into a shopping list); the user's own MUST NOT need loading by link.
- **FR-004**: Statuses MUST be read only through BoardGameGeek's official API with the app's token, cached, and read again on manual refresh or when a status list (or Lists › Status lists) is opened and the cached copy is older than 1 hour.
- **FR-005**: When BoardGameGeek answers that the collection is being prepared, the app MUST wait and retry on its own with growing pauses, show that it is waiting, and give up with a retry offer after about one minute.
- **FR-006**: The last loaded statuses MUST stay available offline, with the time they were loaded.
- **FR-007**: Users MUST be able to open the status lists of any BoardGameGeek user (e.g. a friend's wishlist) by pasting a link to that user's collection page (with its status filter, e.g. `wishlist=1`) into "Load a BGG list"; it then appears in Lists › Status lists under that person's name, read-only (never written to), and does not create badges.

**Badges**

- **FR-008**: Every place that shows a game (shopping list row, BGG list row, search result, swipe card, game sheet) MUST show the user's BoardGameGeek statuses for it as text badges, in the fixed order of FR-009; rows show at most two plus "+n".
- **FR-009**: Badge order: Owned, Preordered, Wishlist n, Want to play, For trade, Want in trade, Want to buy, Previously owned.
- **FR-033**: Each status MUST have its own badge colour, chosen from the app's palette in Config (Badge colours, with Reset colours); the choice is remembered on the device. Badges always carry their text, so colour never carries the meaning alone.
- **FR-034**: A game's sheet MUST show, right of the cover: line 1 year · publisher; line 2 all BGG status badges (or "Not in your BGG collection" when a username is set); line 3 the shopping lists the game is in ("in Essen 2026", "in Essen 2026 and Christmas wishes", "in 3 shopping lists"; inside a shopping list only the others, "also in …"), tappable to see and change them; "Open on BoardGameGeek" goes below the cover. Below that, in this order: the info box, the folded Category section (shopping lists only, FR-035), the folded "BGG status" section (its header shows the current badges) and the folded Prices section.
- **FR-035**: In a shopping list, the game's sheet MUST show the category as a folded "Category" section (header: the current category with emoji and colour) instead of the hexagon picker; unfolded it lists the categories as the Category action's sheet does (Must Have … Poop, a line, No category yet and Not interested; the current one marked); a tap sets the category and folds the section.
- **FR-010**: The shopping list filter MUST allow filtering by BGG status (at least: owned / not owned, on wishlist).

**Signing in to BoardGameGeek**

- **FR-011**: Users MUST be able to sign in to BoardGameGeek in Config with username and password; the password MUST be used only for that sign-in and MUST NOT be stored anywhere (device, server, database, logs).
- **FR-012**: The resulting BoardGameGeek session MUST be kept only on the signing-in device, readable only by this app, tied to the signed-in app person, and MUST NOT be sent to the app's database, synced to other devices, included in backups or shared texts, or written to any log.
- **FR-013**: The app's server MAY pass the session on to BoardGameGeek for a single write the user triggered; it MUST NOT keep, cache or log it.
- **FR-014**: Users MUST be able to sign out; signing out removes the session from the device at once. Signing out of the app MUST remove it too.
- **FR-015**: An expired or rejected session MUST be removed and the user asked to sign in again without losing the change in progress.

**Changing statuses**

- **FR-016**: The game sheet MUST show a "BGG status" section with all statuses as labelled toggles and, for Wishlist, a priority 1–5 with BoardGameGeek's names (1 Must have, 2 Love to have, 3 Like to have, 4 Thinking about it, 5 Don't buy this).
- **FR-017**: Saving MUST write only the statuses the user changed to BoardGameGeek, adding the game to the user's BoardGameGeek collection if it is not there; on success, badges and status lists MUST reflect the new state without a manual refresh.
- **FR-018**: Writing MUST happen only on an explicit user action (one save = one write), never in the background or in bulk, and MUST be rate-limited like all BoardGameGeek access.
- **FR-019**: A failed write MUST leave the shown statuses unchanged, explain the cause in one line (offline, signed out, BoardGameGeek refused or unreachable) and offer to retry with the user's choices kept.
- **FR-020**: Writing MUST need a connection; offline the toggles are disabled with a one-line reason (no queued writes).
- **FR-021**: After the user ticks a game as bought, in a shopping list (feature 001) or on a game's prices screen from Buy › Search, and the game is not owned on BoardGameGeek, the app MUST offer "Also mark as owned on BoardGameGeek?" with one tap to confirm; when not signed in, confirming leads to the sign-in first. Nothing is written without that tap.
- **FR-030**: Confirming FR-021 MUST also write the game's private info on BoardGameGeek: price paid with currency, acquisition date (day of buying) and acquired from (booth at SPIEL if known, else the shop of the chosen offer, else empty), as shown in the question; empty values are not written.
- **FR-031**: An existing price paid on BoardGameGeek MUST NOT be replaced without the user confirming the replacement; for a game already owned, the app offers only to add the price paid.
- **FR-029**: A game's sheet opened from Buy › Search or a list MUST offer a "Bought it" action that needs no shopping list; it leads only to the question of FR-021.
- **FR-022**: Besides statuses and the private info fields of FR-030 (price paid, currency, acquisition date, acquired from), the app MUST NOT change BoardGameGeek collection data (ratings, comments, plays, current value, quantity, inventory location, private comment) and MUST NOT delete collection entries.

### Key Entities

- **BGG username**: the person's BoardGameGeek name, part of their app settings, synced like their other data.
- **BGG statuses of a game**: the set of status flags (and wishlist priority) the person's BoardGameGeek collection holds for one game; read from BoardGameGeek, cached, never edited locally without writing to BoardGameGeek.
- **Status list**: a BGG list made of all games with one status in one person's BoardGameGeek collection; behaves like a geeklist; the user's own come from their username, friends' from a pasted link.
- **Shopping list**: today's collection under its new visible name; no change to its content or storage.
- **BoardGameGeek session**: proof of the person's sign-in to BoardGameGeek on one device; device-local, per app person, never stored on the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After entering a username, a user sees their status lists with counts in under 10 seconds for a collection of 500 games (once BoardGameGeek has prepared it).
- **SC-002**: While swiping a SPIEL preview, 100% of games the user owns on BoardGameGeek show "Owned" on the card.
- **SC-003**: Changing a game's status and saving takes at most 3 taps from the game sheet, and the change is visible on the BoardGameGeek website right after the confirmation.
- **SC-004**: No BoardGameGeek password or session appears in the app's database, server logs, backups, shared texts or another device; verified by a review of all places data leaves the device.
- **SC-005**: A user who has never signed in to BoardGameGeek in the app can still use every reading feature (status lists, badges, filters).

## Assumptions

- BoardGameGeek has no official way to change a collection; writing uses BoardGameGeek's own website endpoints with the user's own session, as other community tools (e.g. the SPIEL auction tool) do. This is a new kind of BoardGameGeek use that constitution principle V does not cover yet; the plan must justify it, ideally with an ADR and a constitution amendment, and keep it to the user's explicit single saves.
- Reading needs no sign-in: public collections are readable through the official API with the app's token. Private collections are out of scope; private info is only looked at, with the user's own sign-in, when writing a price paid (FR-031).
- Only the subtype "board game" (with expansions) is shown; RPG and video game items are left out.
- Statuses belong to the person's own BoardGameGeek account; the app never writes to anyone else's.
- Status lists are not stored as shopping lists; shopping lists built from them are ordinary shopping lists and do not follow later status changes.
- Renaming "collection" to "shopping list" is a change of visible wording only; code, database and the share/backup format keep "collection".
- Selling (marking games for trade, removing Own after a sale) is out of scope and planned as a later feature.
- The app is used by a small group of friends; there is no shared or server-side BoardGameGeek account.
