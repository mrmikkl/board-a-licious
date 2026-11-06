# Feature design: Buy – Compare Board Game Prices

**Design rules**: [docs/design.md](../../docs/design.md) v2.5.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Agreed**: 2026-11-06

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
starting point in the black bar ("Start"). Shops, offers and prices are stand-ins; no network. A tap
on an offer shows a toast instead of opening the shop.

## Where the feature lives

- **Menu**: Buy is the first place (bag with €); Config gets the app's cog in the prototype as well.
- **Buy** place: search, then the price screen for the picked game.
- **Game details** (collection) and **Search's game info sheet**: a folded Prices section.

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Menu** | Buy, Collections, BGG lists, Search, Config | Buy: the Buy place |
| **Buy** | heading "Buy"; "Find a game's prices"; search field (as in Search, 0.75 s pause); status line; result rows without + ; no action bar | a result: price screen |
| **Price screen** | ‹ back, "Prices"; game head (cover, name, year · publisher); separator; offers block | an offer: the shop or marketplace in a new tab |
| ↳ offers block | **Both \| English \| German**; fair price line (when known); **New** (fold): offers cheapest total first, not-in-stock last and dimmed; "Show offers with unknown language (n)"; **Used** (fold): marketplace offers from Europe, cheapest first; failed source line with Retry; sources and price age | language: filters at once; fold: hides the group, count stays |
| ↳ new offer | shop ↗, total; "price + shipping" / "free shipping" / "shipping unknown"; EN/DE tag, edition, stock | the shop's page |
| ↳ used offer | marketplace ↗ (BGG marketplace, eBay.de, Kleinanzeigen, unknowns.de), total or "£25,00 ≈ €29,30"; "Used · <condition>", language or "language not stated", auction / Buy it now / VB / pickup, "listed <date>", start of the seller's note | the listing's page |
| ↳ states | loading (spinner, placeholder tiles); one source not reachable (red line, Retry); none found (empty state, "Open on brettspielpreise.de") | — |
| **Game details → Prices** | folded block "💶 Prices" (›); "from €20,00" when loaded recently; tap: unfolds the offers block with the fair price on top (no unknown-language switch) | — |

## Components used

From [docs/design.md](../../docs/design.md) v2.5.0: **Buy**, **Price screen**, **Offers block**,
**Prices section** (new), Menu (changed: Buy first), Search result row (without +), Segment, Empty
state, Separator, Screen heading.

## Decisions from the review (2026-11-06)

- **Buy is the first place** in the menu.
- **A tap on an offer opens the shop's or marketplace's website** (the whole tile is the link).
- In a game's details, prices are a **folded "Prices" section** that expands in place (alternative:
  a Prices action opening the price screen, not chosen).
- **Used offers** come from the BGG marketplace (Europe only, judged by currency), eBay.de,
  Kleinanzeigen and unknowns.de, in their own group below New.
- **New and Used fold** with a tap on their heading; both start unfolded.
- Config's menu icon is the **cog**.
