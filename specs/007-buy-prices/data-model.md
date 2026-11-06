# Data Model: Buy – Compare Board Game Prices

No database change. Prices live only in the Worker's edge cache; the device stores one preference.

## Offer (from `/api/prices`, `src/domain/offers.ts`)

| Field | Type | Rule |
|---|---|---|
| `source` | `'brettspielpreise' \| 'bgg' \| 'ebay' \| 'unknowns'` | where it came from |
| `kind` | `'new' \| 'used'` | brettspielpreise: new; others: used (eBay: by condition) |
| `seller` | string | brettspielpreise: "Shop in <country>"; BGG: "BGG marketplace"; eBay: "eBay.de"; unknowns: "unknowns.de" |
| `country` | ISO code \| null | brettspielpreise: shop's country |
| `title` | string \| null | edition or listing name |
| `language` | `'en' \| 'de' \| 'unknown'` | other languages never reach the device |
| `price` | `{ amount: number, currency: string } \| null` | item price; null = "price in the listing" |
| `shipping` | number (EUR) \| null | null = "shipping unknown"; 0 = free |
| `euroTotal` | number \| null | price in euros (ECB rate for other European currencies) + shipping; sort key |
| `available` | boolean | new offers: stock Y/P; used: true |
| `condition` | string \| null | used: like new, very good, good, acceptable, used |
| `note` | string \| null | used: start of the seller's text (≤ 140 chars) |
| `auction` | `{ endsAt: string } \| null` | eBay auctions |
| `listedAt` | string \| null | used: listing date |
| `link` | URL | brettspielpreise: its redirect link (terms); others: the listing |

## PriceLinks

`{ name: 'Kleinanzeigen' | 'eBay.de' | 'unknowns.de' | 'brettspielpreise.de', url }`: search pages
for the game's name, shown below Used.

## PricesAnswer

`{ bggId, offers: Offer[], links: PriceLinks[], failed: string[], checkedAt: ISO time, sources: string[] }`

## Arranged offers (`arrangeOffers(offers, { language, showUnknown })`)

- language `both | en | de`; `unknown` new offers only when `showUnknown`; used offers with
  `unknown` always.
- New: available first, then `euroTotal` ascending (null last). Used: `euroTotal` ascending, priceless
  last.
- Returns `{ newOffers, usedOffers, hiddenUnknown }`.

## Device meta

`priceLanguage`: `'both' | 'en' | 'de'`, default `'both'`.

## Validation

- `bggId` positive integer; `name` 1–100 characters (for search links and eBay/unknowns matching).
- European currencies: EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF.
