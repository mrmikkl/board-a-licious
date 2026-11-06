# Feature Specification: Buy – Compare Board Game Prices

**Feature Branch**: `007-buy-prices`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "I would like to add to our burger menu an option for Buy. The whole idea is to search for a game, and we use various platforms like Brettspielpreise.de, and maybe you know other sources, which we then search for that board game and then list below the prices of the board game. Two languages for the board game are valid: English and German."

Product context: [docs/vision.md](../../docs/vision.md). Builds on feature
[006](../006-bgg-xml-search/spec.md) (search BoardGameGeek by name, game info sheet). Rules:
[constitution](../../.specify/memory/constitution.md) (mobile-first and accessible, respectful use of
other sites, secrets never in the repository). Look and feel: [docs/design.md](../../docs/design.md) v2.4.0.

**Goal**: before (or instead of) buying a game at the fair, see in one place what it costs in online
shops, for the editions the group can actually play: English or German.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the best price for a game (Priority: P1)

The menu gets a new place, **Buy**. There the user searches a game by its name (the same search as in
the Search place) and picks it. The app then lists the offers it finds at price comparison sites and
shops: shop name, price, shipping, total, the edition's language, whether it is in stock, and a link
to the offer. Only English and German editions are listed; the cheapest total comes first.

**Why this priority**: the core of the request; it answers "is the fair price good, and where else
can I get it?".

**Independent Test**: open Buy, type "cascadia", pick Cascadia: a list of offers appears, cheapest
total first, each with shop, price, shipping, total, language (EN or DE), stock and a working link;
no French or Spanish edition is listed.

**Acceptance Scenarios**:

1. **Given** the menu, **When** the user opens it, **Then** it has a place **Buy** (with its own icon) between Search and Config.
2. **Given** the Buy place, **When** it opens, **Then** a search field is ready (as in Search); typing a name lists matching games after a short pause.
3. **Given** results, **When** the user picks a game, **Then** a price screen opens for that game with its cover and name, and the offers load (a waiting state while they do).
4. **Given** offers were found, **When** they are shown, **Then** each offer shows the shop, the item price, the shipping cost (or "shipping unknown"), the total, the edition's language (English or German), availability (in stock / not in stock), and when the price was last checked; the cheapest available total comes first, offers not in stock after the available ones.
5. **Given** an offer, **When** the user taps it, **Then** the shop's page for it opens in a new tab.
6. **Given** sources list editions in other languages or with unknown language, **When** offers are shown, **Then** only English and German editions are listed; offers whose language is not known are left out by default and can be shown with a "Show offers with unknown language" switch.
7. **Given** no source has an offer, **When** the search finishes, **Then** the screen says "No offers in English or German found" and offers to open the game's page at the price comparison site.
8. **Given** a source is not reachable, **When** offers load, **Then** offers from the other sources still show and one line names the source that failed.

---

### User Story 2 - Check prices from a game the user already has (Priority: P2)

From a game's details in a collection (and from Search's game info sheet), a **Prices** action opens
the same price screen for that game, without searching again.

**Why this priority**: most price checks happen for games already in a collection, standing at the
fair booth.

**Independent Test**: in Essen 2026, open Cascadia's details, tap Prices: the price screen for
Cascadia opens with its offers.

**Acceptance Scenarios**:

1. **Given** a game's details in a collection, **When** the user taps **Prices**, **Then** the price screen for that game opens; Back returns to the details.
2. **Given** a game with a known fair price (booth price from a list or typed in), **When** the price screen shows, **Then** the fair price is shown above the offers for comparison ("At the fair: €38").
3. **Given** Search's game info sheet, **When** the user taps **Prices**, **Then** the same price screen opens.

---

### User Story 3 - Choose which editions count (Priority: P3)

The user can narrow the offers to one language (English only or German only) on the price screen.

**Why this priority**: some in the group only play one language; both stay the default.

**Independent Test**: on Cascadia's price screen, choose "German": only German editions remain.

**Acceptance Scenarios**:

1. **Given** the price screen, **When** the user picks English, German or Both, **Then** the list shows only those editions; Both is the default.
2. **Given** the user picked a language, **When** they open the price screen for another game, **Then** the same choice applies (remembered on the device).

---

### Edge Cases

- A game with several editions (e.g. base game and a big box) at one shop: each edition is its own offer, with the edition's name when the source gives one.
- The same shop listed by two sources: shown once, with the lower total, naming the source.
- Prices in other currencies are not converted: only offers in euros from shops delivering to Germany are shown.
- An expansion picked in Buy: works like a base game.
- The user is offline: the price screen says so and offers to retry; nothing is queued.
- A source changes its pages or answers slowly: its offers are missing with the one-line note, the screen never hangs longer than about 10 seconds before showing what it has.
- Very long shop or edition names wrap; the total stays visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The menu MUST offer a place **Buy** with its own icon, between Search and Config.
- **FR-002**: Buy MUST start with a search by name that works like the Search place (same results, pause and states); picking a result opens the price screen.
- **FR-003**: The price screen MUST show the game (cover, name, year) and the offers found for it at the price sources, each with shop, item price, shipping (or "shipping unknown"), total, edition language, availability, the time the price was checked, and a link that opens the offer in a new tab.
- **FR-004**: Offers MUST be limited to English and German editions; offers of unknown language MUST be hidden by default and shown on request; other languages MUST never be shown.
- **FR-005**: Offers MUST be ordered by total price (item + shipping), available offers first; shipping is to Germany, prices in euros.
- **FR-006**: Price sources MUST include brettspielpreise.de; further sources MAY be added when they allow automated reading of their prices (see Assumptions); each offer MUST name the source it came from.
- **FR-007**: When a source fails or times out, the other sources' offers MUST still be shown, with one line naming the failed source and a retry.
- **FR-008**: A game's details in a collection and Search's game info sheet MUST offer a **Prices** action that opens the price screen for that game.
- **FR-009**: When the game has a fair price in the current collection, the price screen MUST show it above the offers for comparison.
- **FR-010**: The price screen MUST offer a language choice (Both, English, German), Both by default, remembered on the device.
- **FR-011**: Prices MUST be read only on the server, only when a person opens a price screen, cached for a while (prices up to a few hours old are acceptable and labelled with their age), and never more often than the source allows.
- **FR-012**: New screens MUST follow the design rules and be accessible: offers are a list, each offer's link is named "<shop>, <total>, <language>", the language choice is a segmented control, states (loading, none found, source failed, offline) are announced.

### Key Entities

- **Price source**: a price comparison site or shop the app reads offers from (name, link, which shops it covers).
- **Offer**: one buyable edition of a game at one shop: shop, source, item price, shipping, total, currency (EUR), language (English, German, unknown), edition name, availability, link, checked at.
- **Language choice**: Both, English or German; stored per device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the menu, a person sees the offers for a named game in under 20 seconds and at most 4 taps after typing.
- **SC-002**: Offers appear within 5 seconds for 90% of games (within 1 second when the game's prices were checked in the last hours).
- **SC-003**: For a sample of 10 popular games, at least 8 show at least 3 offers in English or German.
- **SC-004**: 0 offers in other languages are shown (checked on the same sample).
- **SC-005**: From a game in a collection, the price screen opens in one tap.

## Assumptions

- "by" in the request means **Buy**.
- Shipping destination is Germany and prices are in euros; other countries and currencies are out of scope.
- brettspielpreise.de is the first source. It lists many German shops and the edition language. Further candidates are checked in the plan: board game price sites and large shops such as Spiele-Offensive, Milan-Spiele, Fantasywelt, Amazon.de and idealo. A source is used only if it offers an official way to read prices (an API or a feed) or its terms allow automated reading. Sites whose terms forbid it are left out, with no scraping against a site's terms (in the spirit of constitution V). If brettspielpreise.de itself needs an API key or agreement, the owner requests it; the key lives only as a server secret.
- Buying happens at the shop; the app does not put anything into a cart, track orders or mark the game bought (the existing Buy action in a collection stays as it is).
- Used/second-hand offers and BGG marketplace listings are out of scope.
- The edition language comes from the source; when it does not say, the offer's language is "unknown".
- An ADR records the choice of price sources and how they are read (they bind later features).
