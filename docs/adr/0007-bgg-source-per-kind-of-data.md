# 0007. BoardGameGeek source chosen per kind of data

- **Status**: Proposed
- **Date**: 2026-11-05
- **Origin**: `specs/006-bgg-xml-search/research.md` R2; constitution Principle V; supersedes the
  selection rule of [ADR 0005](0005-bgg-adapter-and-bridge.md)

## Context

The app now has an official BGG XML API token. ADR 0005 planned to switch the whole adapter to an
`XmlApiSource` once the token exists. The official API offers game details with ratings, search and
geeklists, but not SPIEL previews (with booths and prices), company lookups or image galleries.
Constitution V requires the official API for every kind of data it offers once a token exists and
allows the website data only for the rest, until 2027-01-31 at the latest.

## Decision

We keep ADR 0005's single server-side adapter interface (`BggSource`) and choose the implementation
**per kind of data** once in the Worker: with `BGG_TOKEN` set, game details, search and geeklists use
`OfficialSource` (XML API, `Authorization: Bearer`); previews, company names and image galleries use
`GeekdoSource`. Without the token, `GeekdoSource` serves everything as before and search is
unavailable. Both share one throttled, cached client.

## Consequences

- Turning the token on is still a deployment setting; nothing outside the adapter changes.
- Two sources stay in the code until BGG offers previews and galleries officially or the exception
  ends (2027-01-31); then previews and galleries need a new decision.
- A rejected token makes the official kinds fail visibly (no silent fallback), and is logged.

## Alternatives considered

- **Switch everything to the XML API (ADR 0005)**: previews and galleries would break.
- **Fall back to website data when the official API fails**: violates constitution V.
