# 0008. Price sources: only official APIs and published feeds, links elsewhere

- **Status**: Proposed
- **Date**: 2026-11-06
- **Origin**: `specs/007-buy-prices/research.md` R1–R7; constitution Principle V (by analogy) and
  Product & Technical Constraints (secrets)

## Context

Feature 007 shows what a game costs at shops and on marketplaces. Possible sources differ: some offer
an official API (brettspielpreise.de, the BGG marketplace through BGG's XML API, eBay's Browse API with
approval), some publish a feed (unknowns.de's marketplace RSS), some forbid automated access
(Kleinanzeigen's terms § 5 Nr. 1) or offer no public interface (idealo, shops directly). Constitution V
sets the rules for BoardGameGeek; nothing yet covers other sites.

## Decision

We read prices only through an official API or a feed the site publishes for reading, following each
source's terms (caching times, attribution, links through the site), from the Worker only, when a person
opens prices, with an honest User-Agent and at most one request per second per host. Sites that forbid
automated access or offer no such interface are shown as **search links** only. Keys (eBay) are Worker
secrets; a source whose keys are missing falls back to its link. Sources: brettspielpreise.de (new),
BGG marketplace (used, Europe by currency), eBay.de (used, with approved keys), unknowns.de feed (used);
links: Kleinanzeigen, eBay.de (without keys), unknowns.de, brettspielpreise.de.

## Consequences

- No scraping; adding a source means checking its API or feed and its terms first, then one adapter.
- Shop names for new offers are not available (brettspielpreise.de leaves them out on purpose); offers
  show the shop's country.
- Kleinanzeigen offers are never inside the app; eBay offers only after eBay's approval.

## Alternatives considered

- **Scraping shop and classifieds pages**: against several sites' terms and fragile.
- **Third-party scraping services (Apify, ScrapingBee)**: the same terms problem, plus costs and keys.
- **Only brettspielpreise.de**: simple, but no used copies, which the user asked for.
