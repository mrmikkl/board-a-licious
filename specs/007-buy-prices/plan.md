# Implementation Plan: Buy – Compare Board Game Prices

**Branch**: `007-buy-prices` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-buy-prices/spec.md`, design rules
[docs/design.md](../../docs/design.md) v2.5.0, feature design [design.md](design.md), accepted ADRs
0001–0007 in [docs/adr/](../../docs/adr/README.md). Builds on feature 006 (BGG search, official BGG
client, game info sheet).

## Summary

A new first menu place **Buy** searches a game (feature 006's search) and opens a **price screen**;
game details and Search's game info sheet get a folded **Prices** section with the same **offers
block**. One Worker route `GET /api/prices` asks the allowed sources in parallel:
brettspielpreise.de's public API for new offers (English and German editions, by BGG id), the BGG
marketplace through the official API (Europe only, by currency, with ECB rates for "≈ €"), eBay.de's
Browse API once the owner has approved keys, and unknowns.de's public marketplace feed. Kleinanzeigen
forbids automated access, so it (and eBay until approved) is a **search link**. Sources and access
rules are recorded in [ADR 0008](../../docs/adr/0008-price-sources.md).

Research changed two things in the spec (amended): brettspielpreise.de gives no shop names, so a new
offer shows the shop's country ("Shop in Germany") and "via brettspielpreise.de"; Kleinanzeigen (and
eBay without keys) appear as links, not as offers.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as before (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, idb, postgres, fast-xml-parser (feature 006); no new dependency

**Storage**: no database change; prices only in the edge cache (1 hour; ECB rates 12 hours); device meta `priceLanguage`

**Testing**: Vitest unit (`arrangeOffers`, `listingLanguage`, `toEuro`), Vitest worker (each source against recorded fixtures: brettspielpreise.de JSON, BGG marketplace XML, unknowns.de RSS, ECB XML, eBay JSON; `/api/prices` with a failing and a slow source; eBay off without keys), Playwright with `/api/prices` faked

**Target Platform**: mobile browsers, installed PWA; Cloudflare Workers

**Project Type**: web application, one Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: offers within 5 s for 90% of games, within 1 s from the cache (SC-002); each source at most 8 s

**Constraints**: sources only where reading is allowed (ADR 0008); brettspielpreise.de's terms (link back, ≥ 1 h cache, offer links through the site); constitution V for BGG; secrets (eBay keys) only as Worker secrets; prices read only when a person opens prices

**Scale/Scope**: 1 route, 5 small source adapters, 1 domain module, 2 screens (Buy, price screen), 2 components (OffersBlock, PricesSection), menu and router changes; 1 ADR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0.

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | Offers are links named "<shop/marketplace>, <total>, <language>[, used]"; group headings and Prices are buttons with `aria-expanded`; language choice a segment; status lines announced; 360 px layout from the prototype; spinners off with reduced motion. | ✅ |
| II. Test-First | Fixtures recorded first (R1, R3, R6 real answers; eBay sandbox sample); domain tests before `arrangeOffers`; worker tests per source and for the route's partial failure before the code; Playwright per story against a faked route. | ✅ |
| III. Domain Logic Separate | Sorting, grouping, language filtering, listing language and currency conversion are pure functions in `src/domain/offers.ts`; adapters only map source answers. | ✅ |
| IV. Simplicity (YAGNI) | One route, no database table, no new dependency; shops only through brettspielpreise.de; link-outs where reading is not allowed; eBay only when keys exist. | ✅ |
| V. Respectful BoardGameGeek Integration | The marketplace read uses the official API with the token, cached 1 hour, 1 request/s, only on demand. Other sites follow the same spirit (ADR 0008): official API or published feed, their terms, caching, honest User-Agent, nothing on sites that forbid it. | ✅ |

**Post-design re-check**: all ✅. New ADR 0008 (Proposed) records the price sources and the rule for adding more.

## Project Structure

### Documentation (this feature)

```text
specs/007-buy-prices/
├── spec.md, design.md, design/prototype.html
├── plan.md, research.md (R1–R9), data-model.md, quickstart.md
├── contracts/api.md, contracts/ui.md
└── tasks.md             # /speckit-tasks
docs/adr/0008-price-sources.md   # NEW (Proposed)
```

### Source Code (repository root)

```text
worker/
├── prices/
│   ├── http.ts              # NEW cached fetch with timeout, User-Agent and per-host slot throttle (shared with bgg/cache.ts)
│   ├── brettspielpreise.ts  # NEW api/info → new offers (GB → en, DE → de, others dropped)
│   ├── bgg-market.ts        # NEW thing?marketplace=1 through the official BGG client → used offers (European currencies)
│   ├── ecb.ts               # NEW daily reference rates → toEuro
│   ├── ebay.ts              # NEW Browse API with client-credentials token; off without EBAY_CLIENT_ID/SECRET
│   ├── unknowns.ts          # NEW marketplace RSS → "Biete:" entries matching the name
│   └── links.ts             # NEW search links: Kleinanzeigen, eBay.de (without keys), unknowns.de
├── routes/prices.ts         # NEW GET /api/prices?bggId=&name= (parallel, 8 s per source, partial failure)
└── index.ts                 # wire the route and the sources
src/domain/
└── offers.ts                # NEW Offer types, arrangeOffers, listingLanguage, toEuro, EUROPEAN_CURRENCIES
src/client/
├── api.ts                   # prices(bggId, name)
└── store.ts                 # meta priceLanguage
src/app/
├── router.ts                # #/buy, #/buy/<bggId>
├── components/Menu.tsx      # Buy first; icons.tsx: IconBuy (bag with €)
├── screens/Buy.tsx          # NEW search (useBggSearch, SearchResultRow without +)
├── screens/Prices.tsx       # NEW price screen
├── components/OffersBlock.tsx    # NEW segment, fair price, New/Used folds, offer tiles, unknown switch, failed line, links, sources line
├── components/PricesSection.tsx  # NEW folded block in GameSheet and GameInfoSheet
└── theme/prices.css         # NEW
tests/
├── fixtures/prices/         # NEW brettspielpreise-295947.json, bgg-market-295947.xml, unknowns-feed.xml, ecb-daily.xml, ebay-search.json
├── unit/offers.test.ts
├── worker/prices-*.test.ts
└── e2e/buy.spec.ts, prices-section.spec.ts
```

**Structure Decision**: price sources get their own folder `worker/prices/` beside `worker/bgg/`; the BGG
marketplace adapter reuses the BGG client.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| Five source adapters | the user asked for these sources; each has its own format and rules | one source would leave out used copies entirely |
| Link-outs beside offers | Kleinanzeigen forbids automated access; eBay needs approval first | leaving them out hides useful places; scraping them breaks their terms |
