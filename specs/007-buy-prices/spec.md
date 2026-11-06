# Feature Specification: Buy – Compare Board Game Prices

**Feature Branch**: `007-buy-prices`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "I would like to add to our burger menu an option for Buy. The whole idea is to search for a game, and we use various platforms like Brettspielpreise.de, and maybe you know other sources, which we then search for that board game and then list below the prices of the board game. Two languages for the board game are valid: English and German." Refined after the first draft: Buy is the menu's first place; tapping an offer leads to the shop's website; a game's details get an expandable "Prices" section; sources also include the BoardGameGeek marketplace and the unknowns.de marketplace.

Product context: [docs/vision.md](../../docs/vision.md). Builds on feature
[006](../006-bgg-xml-search/spec.md) (search BoardGameGeek by name, game info sheet, official BGG
access). Rules: [constitution](../../.specify/memory/constitution.md) (mobile-first and accessible,
respectful use of other sites, secrets never in the repository). Look and feel:
[docs/design.md](../../docs/design.md) v2.4.0.

**Goal**: before (or instead of) buying a game at the fair, see in one place what it costs, new in
online shops and used on marketplaces, for the editions the group can actually play: English or German.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find the best price for a game (Priority: P1)

The menu's first place is **Buy**. There the user searches a game by its name (the same search as in
the Search place) and picks it. The app then lists the offers it finds: new copies at shops (through
price comparison sites and shops) and used copies on marketplaces. Each offer shows where it is, the
price, shipping, total, the edition's language, new or used, and whether it is available. Tapping an
offer opens it on the shop's or marketplace's website. Only English and German editions are listed;
the cheapest total comes first.

**Why this priority**: the core of the request; it answers "is the fair price good, and where else
can I get it?".

**Independent Test**: open Buy, type "cascadia", pick Cascadia: new offers appear, cheapest total
first, each with shop, price, shipping, total, language (EN or DE) and stock; used offers follow in
their own group; tapping an offer opens the shop's page; no French or Spanish edition is listed.

**Acceptance Scenarios**:

1. **Given** the menu, **When** the user opens it, **Then** **Buy** (with its own icon) is the first place, above Collections.
2. **Given** the Buy place, **When** it opens, **Then** a search field is ready (as in Search); typing a name lists matching games after a short pause.
3. **Given** results, **When** the user picks a game, **Then** a price screen opens for that game with its cover and name, and the offers load (a waiting state while they do).
4. **Given** new offers were found, **When** they are shown, **Then** each shows the shop, the item price, the shipping cost (or "shipping unknown"), the total, the edition's language (English or German), availability (in stock / not in stock) and when the price was checked; the cheapest available total comes first, offers not in stock after the available ones.
5. **Given** used offers were found on marketplaces, **When** they are shown, **Then** they are listed in their own group "Used" below the new offers, each with the marketplace, price, shipping (or "shipping unknown"), condition, the seller's location when the source gives it, the language when stated ("language not stated" otherwise), the start of the seller's note, and the date it was listed.
6. **Given** the New and Used groups, **When** the user taps a group's heading, **Then** the group folds (its count stays visible) and unfolds again; both start unfolded.
7. **Given** any offer, **When** the user taps it, **Then** the offer opens on the shop's or marketplace's website in a new tab (the whole offer is the link).
8. **Given** sources list new editions in other languages or with unknown language, **When** offers are shown, **Then** only English and German editions are listed; new offers whose language is not known are left out by default and can be shown with a "Show offers with unknown language" switch.
9. **Given** no source has an offer, **When** the search finishes, **Then** the screen says "No offers in English or German found" and offers to open the game's page at the price comparison site.
10. **Given** a source is not reachable, **When** offers load, **Then** offers from the other sources still show and one line names the source that failed.

---

### User Story 2 - Prices in a game's details (Priority: P2)

A game's details in a collection (and Search's game info sheet) get a folded section **Prices**. A tap
on it expands it and loads the same offers as the price screen, right there; a second tap folds it.

**Why this priority**: most price checks happen for games already in a collection, standing at the
fair booth.

**Independent Test**: in Essen 2026, open Cascadia's details, tap Prices: the section expands and
lists Cascadia's offers; tapping an offer opens the shop's page.

**Acceptance Scenarios**:

1. **Given** a game's details in a collection, **When** the details open, **Then** a folded **Prices** section is shown (nothing is loaded yet).
2. **Given** the folded section, **When** the user taps **Prices**, **Then** it expands, shows a waiting state, then the offers (new, then used) as on the price screen, with the same language choice; tapping again folds it.
3. **Given** a game with a known fair price (booth price from a list or typed in), **When** the section expands, **Then** the fair price is shown above the offers for comparison ("At the fair: €38").
4. **Given** Search's game info sheet, **When** the user taps **Prices**, **Then** the same section expands there.

---

### User Story 3 - Choose which editions count (Priority: P3)

The user can narrow the offers to one language (English only or German only).

**Why this priority**: some in the group only play one language; both stay the default.

**Independent Test**: on Cascadia's price screen, choose "German": only German editions remain.

**Acceptance Scenarios**:

1. **Given** the price screen or an expanded Prices section, **When** the user picks English, German or Both, **Then** the list shows only those editions; Both is the default.
2. **Given** the user picked a language, **When** they look at another game's prices, **Then** the same choice applies (remembered on the device).

---

### Edge Cases

- A game with several editions (e.g. base game and a big box) at one shop: each edition is its own offer, with the edition's name when the source gives one.
- The same shop listed by two sources: shown once, with the lower total, naming the source.
- New offers are in euros (shops delivering to Germany). Used offers on the BGG marketplace come only from Europe; BGG gives no seller location, so a listing counts as European by its currency (EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF). A non-euro listing shows its own price with an approximate euro value ("£25 ≈ €29"), which is used for sorting; listings in other currencies (USD, CAD, AUD, …) are left out.
- Marketplace listings are free text: the language is taken from the listing when it states it ("English", "deutsch", …), else "language not stated"; used offers are not hidden for an unstated language.
- A marketplace listing that bundles several games: shown with its title as the edition name and "bundle".
- An eBay auction: shown with its current bid, "auction" and the time left; a fixed price as "Buy it now". A Kleinanzeigen price marked negotiable shows "VB"; pickup-only listings say so, with the town.
- An expansion picked in Buy: works like a base game.
- The user is offline: the price screen or section says so and offers to retry; nothing is queued.
- A source changes its pages or answers slowly: its offers are missing with the one-line note; the screen never waits longer than about 10 seconds before showing what it has.
- Very long shop, edition or listing names wrap; the total stays visible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The menu MUST offer a place **Buy** with its own icon as its first place, above Collections.
- **FR-002**: Buy MUST start with a search by name that works like the Search place (same results, pause and states); picking a result opens the price screen.
- **FR-003**: The price screen MUST show the game (cover, name, year) and the offers found for it: new offers (the shop's name where the source gives it, else its country, e.g. "Shop in Germany", and the source; item price, shipping or "shipping unknown", total, edition language, availability, time checked) and, in their own group "Used", marketplace offers (marketplace, price, shipping or "shipping unknown", condition, seller's location when known, language or "language not stated", the start of the seller's note, date listed).
- **FR-003a**: The New and Used groups MUST fold and unfold with a tap on their heading (a button with its expanded state; the count stays visible); both start unfolded.
- **FR-004**: Every offer MUST be a link that opens the offer on the shop's or marketplace's website in a new tab.
- **FR-005**: New offers MUST be limited to English and German editions; new offers of unknown language MUST be hidden by default and shown on request; offers stating another language MUST never be shown.
- **FR-006**: Offers MUST be ordered by total price (item + shipping) within their group, available new offers first and new offers with unknown shipping after those with known shipping; new offers in euros with shipping to Germany; used offers from Europe only (FR-007a), non-euro prices with an approximate euro value used for sorting.
- **FR-007**: Sources MUST include brettspielpreise.de and the BoardGameGeek marketplace; for used copies also eBay.de, Kleinanzeigen and the unknowns.de marketplace, and for new copies further shops or price sites (Spiele-Offensive, Milan-Spiele, Fantasywelt, Amazon.de, idealo), each when it allows automated reading of its offers (see Assumptions); each offer MUST name its source.
- **FR-007a**: BGG marketplace offers MUST come from Europe only; as BGG gives no seller location, a listing counts as European by its currency (EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF).
- **FR-007b**: A source that may not be read automatically (its terms forbid it, or it needs keys the owner does not have yet) MUST appear as a link that opens its search for the game (Kleinanzeigen; eBay.de until the owner has API keys, a later step; unknowns.de's marketplace), below the Used offers.
- **FR-008**: When a source fails or times out, the other sources' offers MUST still be shown, with one line naming the failed source and a retry.
- **FR-009**: A game's details in a collection and Search's game info sheet MUST have a folded **Prices** section that expands on tap, loads the offers only then, and shows them like the price screen.
- **FR-010**: When the game has a fair price in the current collection, the price screen and the Prices section MUST show it above the offers for comparison.
- **FR-011**: The price screen and the Prices section MUST offer a language choice (Both, English, German), Both by default, remembered on the device.
- **FR-012**: Offers MUST be read only on the server, only when a person opens a price screen or expands Prices, cached for a while (prices up to a few hours old are acceptable and labelled with their age), and never more often than the source allows.
- **FR-013**: New screens and sections MUST follow the design rules and be accessible: offers are a list of links named "<shop or marketplace>, <total>, <language>[, used]", the Prices section is a button with its expanded state, the language choice is a segmented control, and states (loading, none found, source failed, offline) are announced.

### Key Entities

- **Price source**: a price comparison site, shop or marketplace the app reads offers from (name, link, kind: new or used).
- **Offer**: one buyable copy or edition of a game: source, shop or marketplace, new or used (with condition), item price, shipping, total, currency (EUR), language (English, German, unknown), edition or listing name, availability, seller's location (used), link, checked or listed at.
- **Language choice**: Both, English or German; stored per device.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the menu, a person sees the offers for a named game in under 20 seconds and at most 4 taps after typing.
- **SC-002**: Offers appear within 5 seconds for 90% of games (within 1 second when the game's prices were checked in the last hours).
- **SC-003**: For a sample of 10 popular games, at least 8 show at least 3 new offers in English or German.
- **SC-004**: 0 new offers in other languages are shown (checked on the same sample).
- **SC-005**: From a game's details, the offers are visible after one tap on Prices.

## Assumptions

- "by" in the request means **Buy**.
- Shipping destination is Germany and prices are in euros; other countries and currencies are out of scope.
- brettspielpreise.de is the first source for new offers. It lists many German shops and the edition language.
- The BoardGameGeek marketplace is read through BGG's official API (feature 006's token): checked 2026-11-06, it lists a game's offers with date, price and currency, condition, the seller's note and a link (74 for Cascadia, in GBP, USD, EUR, …), but no seller location or shipping; only listings in European currencies are shown (FR-007a), converted to an approximate euro value at a daily exchange rate.
- Sources the plan checks: for used copies eBay.de (fixed-price and auction offers, with the auction's end time), Kleinanzeigen (classifieds, with the seller's town and whether the price is negotiable, "VB") and unknowns.de's marketplace (a forum section); for new copies Spiele-Offensive, Milan-Spiele, Fantasywelt, Amazon.de and idealo.
  - A source is used only if it offers an official way to read offers (an API or a feed) or its terms allow automated reading. Sites whose terms forbid it, or that need a personal login, are left out, with no scraping against a site's terms (in the spirit of constitution V).
  - Where a source needs an API key or agreement, the owner requests it; the key lives only as a server secret.
- Buying happens at the shop or with the seller; the app does not put anything into a cart, contact sellers, track orders or mark the game bought. The existing Buy action in a collection stays as it is.
- The edition language comes from the source; for marketplace listings it is read from the listing's text when stated.
- An ADR records the choice of sources and how they are read (they bind later features): [ADR 0008](../../docs/adr/0008-price-sources.md).
- Found in planning (research R1–R6): brettspielpreise.de's API gives no shop names (on purpose), so new offers show the shop's country; Kleinanzeigen forbids automated access (terms § 5 Nr. 1) and is a link only; eBay's Browse API needs eBay's approval for production, so eBay is a link until the owner has approved keys; unknowns.de offers only a feed of its newest 20 entries, so few matches are expected.
