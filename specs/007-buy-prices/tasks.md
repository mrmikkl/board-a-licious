# Tasks: Buy – Compare Board Game Prices

**Input**: Design documents from `/specs/007-buy-prices/`
**Prerequisites**: plan.md, spec.md, design.md, research.md (R1–R9), data-model.md, contracts/api.md,
contracts/ui.md, quickstart.md; design rules `docs/design.md` v2.5.0; ADRs 0001–0008; the code of
features 001–006.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before the
code it covers and must fail first. No live sources in tests: answers come from
`tests/fixtures/prices/`; e2e tests fake `/api/prices` in `tests/e2e/helpers.ts`.

**Organization**: US1 (Buy place and price screen, P1), US2 (Prices section in details, P2), US3
(language choice, P3). US2 and US3 reuse US1's offers block.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US1–US3)

---

## Phase 1: Setup

- [X] T001 Record real answers into `tests/fixtures/prices/` with a one-off script `scripts/record-prices.mjs` (honest User-Agent, one request per second): `brettspielpreise-295947.json` (`/api/info?eid=295947&sitename=<app url>&currency=EUR&destination=DE&locale=en&sort=CHEAP1`), `bgg-market-295947.xml` (`thing?id=295947&marketplace=1`, token from `.dev.vars`, never printed), `unknowns-feed.xml` (`/marketplace/marketplace-feed/`), `ecb-daily.xml`; trim each to a handful of entries and add, by hand, one unknowns.de feed entry "Biete: Cascadia (deutsch)" so the matcher has a hit
- [X] T002 [P] Add `fakePrices(page, answer)` to `tests/e2e/helpers.ts`: fakes `GET /api/prices` with a given `PricesAnswer` (contracts/api.md), optional delay and a `failed` list; export a `CASCADIA_PRICES` sample with new EN/DE/unknown offers, used BGG (EUR and GBP) and unknowns.de offers, and the three links

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 [P] Write failing unit tests in `tests/unit/offers.test.ts` for `arrangeOffers(offers, { language, showUnknown })` (data-model "Arranged offers": language `both | en | de`; unknown new offers only with `showUnknown`; used offers with `unknown` always; New: available first, then `euroTotal` ascending, null last; Used: `euroTotal` ascending, priceless last; returns `{ newOffers, usedOffers, hiddenUnknown }`), `listingLanguage(text)` (research R8: "English", "englisch", "EN" as a word, "(engl.)" → en; "Deutsch", "German", "DE" as a word, "deutsche Ausgabe" → de; both or none → unknown), `toEuro(amount, currency, rates)` and `EUROPEAN_CURRENCIES` (EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF)
- [X] T004 Implement `src/domain/offers.ts` (types `Offer`, `PriceLinks`, `PricesAnswer`, `PriceLanguage` as in data-model.md, and the functions of T003)
- [X] T005 [P] Write failing worker tests in `tests/worker/prices-http.test.ts` for `worker/prices/http.ts`: `getText(url, ttl)` / `getJson` with the edge-or-memory cache keyed by URL, an 8 s timeout per request (`AbortSignal.timeout`) mapped to a `PriceSourceError`, an honest `User-Agent`, one request per second per host by booked slots (no promise shared across requests, feature 006 R11)
- [X] T006 Implement `worker/prices/http.ts`, sharing the slot-booking throttle with `worker/bgg/cache.ts` (extract `createSlots(minGapMs, now, sleep)` into `worker/throttle.ts` and use it in both)

**Checkpoint**: `npm test` green; nothing visible changed.

---

## Phase 3: User Story 1 - Find the best price for a game (Priority: P1) 🎯 MVP

**Goal**: Buy is the first menu place; search a game; the price screen lists new and used offers (English and German), cheapest first, with links, failures and link chips.

**Independent Test**: open Buy, type "cascadia", pick Cascadia: new offers "Shop in Germany …" with EN/DE, cheapest first; used offers below; Kleinanzeigen and eBay.de links; tapping an offer opens it; no French edition.

### Tests for User Story 1

- [X] T007 [P] [US1] Write failing worker tests in `tests/worker/prices-sources.test.ts` against the fixtures: `brettspielpreise.ts` maps items with `versions.lang` GB → en and DE → de, drops other languages, an item without `lang` → unknown, `seller` "Shop in <country>" (DE → Germany, BE → Belgium, …), `price`/`shipping` (`shipping_known` false → null), `available` for stock Y/P, `link` kept as given, `sitename` and `destination=DE` in the request; `bgg-market.ts` keeps only European currencies, maps condition (likenew → like new, verygood → very good, …), note (≤ 140 chars), `listedAt`, `euroTotal` via the ECB rates, language from `listingLanguage(notes)`; `ecb.ts` parses the daily rates; `unknowns.ts` returns only "Biete:" entries whose title contains the game's name (case and accents ignored), price null, link to the entry; `links.ts` builds the Kleinanzeigen search (`https://www.kleinanzeigen.de/s-<name>/k0`), eBay.de search for used board games and the unknowns.de marketplace link
- [X] T008 [P] [US1] Write failing worker tests in `tests/worker/prices-route.test.ts` for `GET /api/prices` (contracts/api.md): 400 for a missing or invalid `bggId` ("positive integer") or `name` ("1–100 characters"); all sources asked in parallel; a source that throws or exceeds 8 s is named in `failed` while the others answer 200; `checkedAt` is the oldest cached part; a second call within an hour makes no upstream request
- [X] T009 [P] [US1] Write failing Playwright tests in `tests/e2e/buy.spec.ts` with `fakePrices` and feature 006's `fakeSearch` against contracts/ui.md: Buy is the first menu link; Buy has the search field "Find a game's prices", no action bar, result rows without add buttons; picking Cascadia opens `#/buy/<id>` with heading "Prices", the game, New offers in order with links named "<seller>, <total>, <language>[, not in stock]" and `target="_blank"`, Used offers with "used" in their names and "≈ €" for GBP, the unknown-language checkbox shows the hidden offer, the three link chips, a failed source line with Retry, the loading status and the none state with "Open on brettspielpreise.de"; New and Used fold and unfold (`aria-expanded`); axe clean at 360 px and with reduced motion

### Implementation for User Story 1

- [X] T010 [P] [US1] Implement `worker/prices/brettspielpreise.ts`, `worker/prices/ecb.ts`, `worker/prices/unknowns.ts` and `worker/prices/links.ts` to pass T007 (brettspielpreise.de cached 1 h as its terms ask; ECB 12 h; unknowns.de feed 1 h)
- [X] T011 [US1] Implement `worker/prices/bgg-market.ts` through feature 006's official client (`getXml`, `TTL.list` 1 h) to pass T007; without the BGG token it returns nothing (no website fallback)
- [X] T012 [US1] Add `worker/routes/prices.ts` and wire `GET /api/prices` in `worker/index.ts` to pass T008 (sources in parallel with `Promise.allSettled`, each wrapped in the 8 s timeout)
- [X] T013 [P] [US1] Add `prices(bggId, name)` to `src/client/api.ts`, `IconBuy` (bag with €, as in the prototype) to `src/app/components/icons.tsx`, the routes `#/buy` and `#/buy/<bggId>` to `src/app/router.ts` (with tests in `tests/unit/router.test.ts`), and Buy as the first entry of `PLACES` in `src/app/components/Menu.tsx`
- [X] T014 [US1] Add `src/app/components/OffersBlock.tsx` and `src/app/theme/prices.css` per docs/design.md "Offers block": language segment (state from props for now), fair-price line, New/Used fold buttons, offer tiles as links (`target="_blank" rel="noopener noreferrer"`), unknown-language checkbox, link chips, failed line with Retry, loading and none states, sources line linking to brettspielpreise.de; it calls `arrangeOffers`
- [X] T015 [US1] Add `src/app/screens/Buy.tsx` (feature 006's `useBggSearch(50)` and `SearchResultRow` without `onAdd`, label "Find a game's prices") and `src/app/screens/Prices.tsx` (game head from `/api/bgg/games`, `OffersBlock` fed by `api.prices`, Back to Buy); render both in the app's route switch

**Checkpoint**: Buy works end to end and is deployable.

---

## Phase 4: User Story 2 - Prices in a game's details (Priority: P2)

**Goal**: a folded Prices section in a game's details and in Search's game info sheet, loading offers only when expanded, with the fair price on top.

**Independent Test**: in a collection, open Cascadia's details, tap Prices: offers load in place; the fair price shows above them; tapping again folds it.

### Tests for User Story 2

- [X] T016 [P] [US2] Write failing Playwright tests in `tests/e2e/prices-section.spec.ts` with `fakePrices` and `seedCollection` (a game with a listed price): the details show a button "Prices" with `aria-expanded="false"` and no request to `/api/prices` yet; tapping it loads and shows the offers and "At the fair: €38,00"; tapping again folds it; the same section works in Search's game info sheet; axe clean

### Implementation for User Story 2

- [X] T017 [US2] Add `src/app/components/PricesSection.tsx` (heading button "💶 Prices" with chevron and `aria-expanded`, `OffersBlock` without the unknown-language switch, fetch on first expand, fair price from the entry's facts) and place it in `src/app/components/GameSheet.tsx` between the info box and the actions, and in `src/app/components/GameInfoSheet.tsx` before Close

**Checkpoint**: prices from a collection in one tap.

---

## Phase 5: User Story 3 - Choose which editions count (Priority: P3)

**Goal**: Both | English | German, remembered on the device.

**Independent Test**: on Cascadia's prices choose German: only German editions; open another game's prices: German is still chosen.

### Tests for User Story 3

- [X] T018 [P] [US3] Extend `tests/e2e/buy.spec.ts`: choosing German leaves only German new offers (used offers with an unstated language stay); after opening another game and reloading, German is still pressed; the Prices section uses the same choice

### Implementation for User Story 3

- [X] T019 [US3] Add device meta `priceLanguage` (`'both' | 'en' | 'de'`, default `'both'`) to `src/client/store.ts` (`MetaValues`) with a unit test in `tests/unit/store.test.ts`, and connect `OffersBlock`'s segment to it in `src/app/components/OffersBlock.tsx`

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `CLAUDE.md` (code layout: `worker/prices/`, `src/domain/offers.ts`; ADR 0008 rule: no scraping, links where reading is not allowed) and `docs/hosting/setup.md` (no new secret; eBay keys later)
- [ ] T021 Run `npm test`, `npm run build` and `npm run test:e2e`; record the results here
- [ ] T022 Deploy (`npm run deploy`) and walk through `specs/007-buy-prices/quickstart.md` ("Against the real sources") with the user

---

## Dependencies & Execution Order

- **Setup** → **Foundational** → US1 → US2 and US3 (both reuse `OffersBlock`) → Polish.
- T001's fixtures before T007; T004 before T010–T012 and T014; T006 before T010–T011.
- Same-file order: `src/app/components/OffersBlock.tsx` T014 → T019; `tests/e2e/buy.spec.ts` T009 → T018; `worker/index.ts` only in T012.

## Parallel Opportunities

- Phase 1: T002 alongside T001.
- Phase 2: T003 and T005 together; then T004 and T006.
- US1: T007, T008, T009 together; T010 and T013 together; then T011 → T012, T014 → T015.
- US2 (T016) and US3 (T018) tests can be written while US1's UI is built.

## Implementation Strategy

1. **MVP**: Phases 1–3 → test → deploy. Buy with prices from brettspielpreise.de, the BGG marketplace and unknowns.de, plus links (SC-001–SC-004).
2. **Then** US2 (Prices in details, SC-005) → deploy; US3 → deploy; Polish.
3. **Later, not in this feature**: eBay offers through the Browse API once the owner has keys (`worker/prices/ebay.ts`, research R4); shop names if brettspielpreise.de agrees (`outreach.md`).

Suggested Orca Swarm split (docs/orca-swarm.md), after Phase 2 on the branch: A = server
(T007, T008, T010–T012), B = app (T009, T013–T015, then T016–T019). Merge order A → B.
