# Contract: API

## `GET /api/prices?bggId=<id>&name=<game name>`

- `bggId`: positive integer; `name`: 1–100 characters (used for search links, eBay and unknowns.de).
- `200`:
  ```json
  { "bggId": 295947, "checkedAt": "2026-11-06T18:00:00Z",
    "sources": ["brettspielpreise.de", "BGG marketplace", "unknowns.de"],
    "failed": [],
    "offers": [
      { "source": "brettspielpreise", "kind": "new", "seller": "Shop in Germany", "country": "DE",
        "title": "Cascadia", "language": "de", "price": { "amount": 31.95, "currency": "EUR" },
        "shipping": 3.9, "euroTotal": 35.85, "available": true, "condition": null, "note": null,
        "auction": null, "listedAt": null, "link": "https://brettspielpreise.de/item/go?…" },
      { "source": "bgg", "kind": "used", "seller": "BGG marketplace", "country": null, "title": null,
        "language": "unknown", "price": { "amount": 25, "currency": "GBP" }, "shipping": null,
        "euroTotal": 29.3, "available": true, "condition": "very good", "note": "Collection only…",
        "auction": null, "listedAt": "2026-10-30", "link": "https://boardgamegeek.com/market/product/4176814" }
    ],
    "links": [ { "name": "Kleinanzeigen", "url": "https://www.kleinanzeigen.de/s-cascadia/k0" } ],
    "siteSearch": "https://brettspielpreise.de/item/search?search=Cascadia" }
  ```
- Offers in other languages and BGG listings in non-European currencies are dropped on the server.
- A source that fails or takes over 8 s is listed in `failed`; the rest still answer (never 5xx for one source).
- `400 bad_request` for a missing or invalid `bggId`/`name`.
- Cached per source (see research R7): parts may be up to an hour old; `checkedAt` is the time of this answer, and the screen says "prices up to an hour old".

## Upstream (server only)

| Source | Request | Cache |
|---|---|---|
| brettspielpreise.de | `https://brettspielpreise.de/api/info?eid=<id>&sitename=<app>&currency=EUR&destination=DE&locale=en&sort=CHEAP1` | 1 h |
| BGG marketplace | `https://boardgamegeek.com/xmlapi2/thing?id=<id>&marketplace=1` (official client, token) | 1 h |
| ECB | `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml` | 12 h |
| eBay (later, with keys; not in this feature) | `POST https://api.ebay.com/identity/v1/oauth2/token` (client credentials); `GET https://api.ebay.com/buy/browse/v1/item_summary/search?q=<name>&category_ids=180349&filter=…` with `X-EBAY-C-MARKETPLACE-ID: EBAY_DE` | token until expiry; search 1 h |
| unknowns.de | `https://unknowns.de/marketplace/marketplace-feed/` | 1 h |
