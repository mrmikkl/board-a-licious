# Research: Buy – Compare Board Game Prices

Phase 0 of [plan.md](plan.md). Checked on 2026-11-06 with real requests where possible.

## R1. New offers: brettspielpreise.de (BoardGamePrices)

- **Decision**: read `https://brettspielpreise.de/api/info?eid=<bggId>&sitename=<app url>&currency=EUR&destination=DE&locale=en&sort=CHEAP1`, the documented public API that BoardGamePrices' WordPress plugin uses ([API docs](https://boardgameprices.eu/api/plugin)).
- **Checked**: Cascadia (295947) answered without a key with one *item* per edition language: `versions.lang` `["GB"]` (English, 50 offers), `["DE"]` (German, 19 offers), plus NL, FR, Nordic, ES, GR, IT, PL and Baltic editions. Each offer has `price` (total), `product`, `shipping`, `shipping_known`, `stock` (Y/N/P/?), the shop's `country` and a `link`.
- **Terms** (from the API page): free to use in your own project; show the site's name/logo and link back; **cache for at least one hour**; send people through the offer `link` (it redirects via brettspielpreise.de to the shop). **No shop names**: the API deliberately leaves them out ("the only thing missing").
- **Decided with the owner (2026-11-06)**: build with the country now and ask brettspielpreise.de for a shop name field or permission to show it (draft in `specs/007-buy-prices/outreach.md`); following each redirect to learn the shop was rejected (it would count as clicks on their links).
- **Consequence for the spec**: a new offer shows the shop's **country** ("Shop in Germany", flag) instead of its name, and "via brettspielpreise.de"; the tap still ends on the shop's page (FR-003/FR-004 amended). Spiele-Offensive, Milan-Spiele, Fantasywelt, Thalia and most German shops are covered this way.
- Mapping: `GB` → English, `DE` → German, other languages → dropped, an item without `lang` → unknown. Edition name from `versions.version` when present, else the item name.
- **Alternatives**: scraping the website (forbidden by the API's purpose and pointless); the Apify scraper (third-party scraping).

## R2. New offers: other shops and price sites

- **Amazon.de**: the Product Advertising API needs an Amazon Associates account with qualifying sales; not available to a private app. Covered by brettspielpreise.de where it lists Amazon offers.
- **idealo**: no public API (only a partner interface for shops to upload their offers); its pages may not be scraped. Not used.
- **Spiele-Offensive, Milan-Spiele, Fantasywelt**: no public APIs found; covered through brettspielpreise.de.
- **Decision**: brettspielpreise.de is the only source of new offers in this feature.

## R3. Used offers: BGG marketplace

- **Decision**: `https://boardgamegeek.com/xmlapi2/thing?id=<bggId>&marketplace=1` through feature 006's official client (token, 1 request/s, cache 1 hour).
- **Checked**: Cascadia has 74 listings: `listdate`, `price` (`currency`, `value`), `condition` (new, likenew, verygood, good, acceptable), `notes`, `link` to the listing. No seller location, no shipping.
- **Europe only** (FR-007a): currencies EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF; others dropped.
- **Exchange rates**: the ECB's daily reference rates (`https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`, free, official), cached 12 hours, for the "≈ €" value.

## R4. Used offers: eBay.de

- **Decision**: the eBay Browse API (`GET /buy/browse/v1/item_summary/search?q=<name>&category_ids=180349`, header `X-EBAY-C-MARKETPLACE-ID: EBAY_DE`, filters `conditionIds` for used, `buyingOptions` FIXED_PRICE/AUCTION, `deliveryCountry:DE`), with an OAuth **application token** (client credentials).
- **Access**: free developer account; the Buy APIs work in the sandbox for anyone, but **production use needs eBay's approval** (eligibility check). The owner registers and applies; the keys (`EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`) are Worker secrets. A third-party page names 5,000 Browse calls a day per application (eBay's call-limits page to be checked when the keys exist).
- **Until approved**: eBay is a **link** "Search on eBay.de" (used board games, the game's name), not offers in the app.
- **Decided with the owner (2026-11-06)**: this feature ships the eBay **link** only; reading eBay through the Browse API is a later step once the owner has keys (then `worker/prices/ebay.ts`). Loading eBay's or Kleinanzeigen's result pages and parsing them was discussed and rejected: it is scraping (one request is enough), against both sites' terms, and their bot protection likely blocks Cloudflare's network anyway.

## R5. Used offers: Kleinanzeigen

- **Checked**: no public API. The Nutzungsbedingungen § 5 Nr. 1 forbid crawlers, spiders, scrapers and other automated mechanisms without Kleinanzeigen's express written consent, and copying others' ads.
- **Decision** (confirmed by the owner 2026-11-06): a **link** "Search on Kleinanzeigen" that opens the site's search for the game's name; no offers read or shown in the app.

## R6. Used offers: unknowns.de

- **Checked**: the marketplace pages need a login (302 to the login page). The forum publishes an RSS feed `https://unknowns.de/marketplace/marketplace-feed/` (ttl 60 min) with the **newest 20 entries** (about one day), titles like "Biete: Lisboa (Lacerda)" / "Suche: …", text, date, author, link; prices only in free text, mostly absent. robots.txt allows it.
- **Decided with the owner (2026-11-06)**: the public feed only; logging in with the owner's account (credentials as a Worker secret) was discussed and rejected, the marketplace is members-only on purpose.
- **Decision**: read the feed (cached 1 hour) and show "Biete:" entries whose title contains the game's name as used offers with "price in the listing"; plus a **link** "Marketplace on unknowns.de". Few matches are expected (only the last day).

## R7. One price request, several sources

- **Decision**: `GET /api/prices?bggId=&name=` on the Worker asks all enabled sources in parallel, each with an 8 s timeout, and answers `{ offers, links, failed, checkedAt }`. Sources share the slot-booking throttle of feature 006 (R11: no promise shared across requests), per host. Caches: brettspielpreise.de and BGG marketplace 1 hour, unknowns.de feed 1 hour, ECB 12 hours, eBay 1 hour per query.
- Offers are sorted and grouped on the device (`arrangeOffers` in `src/domain/offers.ts`): language choice, unknown-language switch, New (in stock first, then total) and Used (approximate euro total).
- **Alternatives**: one route per source (more requests from the phone, more code); storing prices in the database (YAGNI; the edge cache suffices).

## R8. Language of a used listing

- **Decision**: `listingLanguage(text)` in `src/domain/offers.ts`: "English", "englisch", "EN" (as a word), "(engl.)" → English; "Deutsch", "German", "DE" (as a word), "deutsche Ausgabe" → German; both or none → not stated. Kept simple; marketplace offers are never hidden for an unstated language (spec).

## R9. Where the screens live

- Route `#/buy` (search) and `#/buy/<bggId>` (price screen), menu place `buy` first. The Buy search reuses feature 006's `useBggSearch` and `SearchResultRow` (compact off, no +). The offers block is one component used by the price screen and the Prices section (GameSheet, GameInfoSheet). The language choice is device meta `priceLanguage`.
