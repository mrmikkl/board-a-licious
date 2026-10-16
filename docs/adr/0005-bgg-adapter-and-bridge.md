# 0005. BoardGameGeek behind one adapter, token-free bridge until the XML API

- **Status**: Accepted
- **Date**: 2026-10-16
- **Origin**: `specs/001-bgg-game-collection/research.md` R4, R4a; constitution v1.1.0 Principle V

## Context

BoardGameGeek is the source of all game data. Its official XML API requires a registered
application and token (unauthenticated requests return 401, checked 2026-10-16); approval may take
longer than the time left before SPIEL Essen 2026 (2026-10-22). BGG's website uses a public JSON
API (`api.geekdo.com`) that answers without a token for game details and geeklists, but not for
search. Neither API sends CORS headers, and the token must never reach the browser.

## Decision

All BGG access goes through one server-side interface, `BggSource`, in the Worker, with response
caching. Two implementations:

- `GeekdoSource` (Release 0.5): public website JSON, under the time-limited exception in
  constitution Principle V; no search.
- `XmlApiSource` (Release 1.0): official XML API with the token; adds search.

The Worker selects `XmlApiSource` when the `BGG_TOKEN` secret is set. Nothing outside the adapter
knows which source is active.

## Consequences

- The app works before the token exists; switching is a deployment, not a redesign.
- The bridge is undocumented and may change or be blocked (possibly from Cloudflare's network), so
  it is verified first and kept small. The exception lapses once the token exists.
- Name search in 0.5 covers loaded geeklists only.

## Alternatives considered

- **Wait for the token**: nothing usable at the fair.
- **Scraping HTML pages or a search engine (e.g. SearXNG)**: blocked by bot protection or
  unreliable from data-center IPs; excluded by the constitution exception.
- **Calling BGG from the browser**: impossible without CORS, and would expose the token.
