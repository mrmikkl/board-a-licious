# Implementation Plan: Official BGG Data and Search

**Branch**: `006-bgg-xml-search` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-bgg-xml-search/spec.md`, design rules
[docs/design.md](../../docs/design.md) v2.4.0, feature design [design.md](design.md), accepted ADRs
0001–0006 in [docs/adr/](../../docs/adr/README.md). Builds on features 001 (BGG adapter, games,
lists, the switched-off Search place), 004 (gallery) and 005 (ratings, adding with a category).

## Summary

With `BGG_TOKEN` set, the Worker answers game details (with ratings), geeklists and the new search
from BoardGameGeek's **official XML API**; SPIEL previews, the companies they name and image galleries
stay on the website JSON under the constitution's exception. One `BggSource` per kind of data,
chosen once in the Worker ([ADR 0007](../../docs/adr/0007-bgg-source-per-kind-of-data.md), which
supersedes ADR 0005's "switch everything" rule). The existing throttled, cached client learns to
send the token and read XML; XML is parsed with `fast-xml-parser` (pure JS, runs in workerd and in
the Node worker tests). New route `GET /api/bgg/search` returns ranked id/name/year/kind results;
the app fetches covers and details through the existing `GET /api/bgg/games`.

The **Search** screen becomes real (field, status line, result rows with a big +, game info sheet,
add to collections sheet; no action bar). **Add game** gets one field for name or link with up to 8
matches. Without a token, everything is as before. No migration, no change to sync or entries.

Delivery: US2's adapter work first (it is the base and changes nothing visible), then US1 (Search),
then US3 (Add game by name). Each is deployable alone; the token is switched on by the owner with
`npx wrangler secret put BGG_TOKEN` after US2 is deployed.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), as before (ADR 0006)

**Primary Dependencies**: React 19, Vite 8, vite-plugin-pwa, idb, postgres; **new**:
`fast-xml-parser` ^5 (Worker only, research R3)

**Storage**: Neon PostgreSQL `game` table unchanged (official data fills the same columns); BGG
responses in the edge cache (search 1 day, games 7 days, geeklists 1 hour); no IndexedDB change

**Testing**: Vitest unit (`rankResults`, `searchQuery`, `parseGameInput` name vs link), Vitest worker
(XML fixtures: thing batch with stats, search, geeklist incl. 202 retry; token header; 401 →
`bgg_unavailable` + log without the token; source selection with/without token; search route
validation and cache), Playwright (`phone`, `phone-reduced-motion`, `offline`) with axe, BGG faked by
route interception

**Target Platform**: mobile browsers (Chrome Android, Safari iOS), installed PWA; Cloudflare Workers

**Project Type**: web application, one Cloudflare Worker serving the SPA and `/api` (ADR 0002)

**Performance Goals**: search results within 2 s for 95% of searches, 0.5 s when cached (SC-002);
covers follow in one more round trip; at most 2 searches for a quickly typed 10-letter name (SC-005)

**Constraints**: constitution V (official API for all data it offers once the token exists; one
request per second; cached; on user demand; token server-side only); design rules v2.4.0; the app
must work unchanged without a token (SC-006); search needs a connection (not queued offline)

**Scale/Scope**: 1 new source + XML parsing (~3 files), 1 client change (token, XML, 202), 1 route,
1 domain module, Search screen rewrite, 3 new components (SearchResultRow, GameInfoSheet,
AddToCollectionsSheet), AddGameSheet changed; 1 ADR

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* Constitution v1.3.0.

| Principle | Check | Status |
|---|---|---|
| I. Mobile-First & Accessible | Result rows ≥ 64px, + 48×54px, both named ("<game>, <year>[, expansion]", "Add <game> to a collection"); result count in a `role=status` line; field labelled; Enter searches; spinner and placeholder shimmer off with reduced motion; no action bar means nothing hidden behind it. | ✅ |
| II. Test-First | Fixtures recorded from the official API first; worker tests for parsing, token header, 401/202/429 handling and source selection before the source; unit tests for ranking and name/link input before the UI; Playwright per story with the BGG routes faked. | ✅ |
| III. Domain Logic Separate | Ranking, query validation and "name or link" are pure functions in `src/domain/bgg-search.ts`; the Worker uses `rankResults`, the UI uses the rest. | ✅ |
| IV. Simplicity (YAGNI) | One dependency (an XML parser instead of a hand-written one, R3); no new table or migration; search results not stored on the device; covers through the existing games route; no collection import. | ✅ |
| V. Respectful BGG Integration | Token only as a Worker secret, sent as `Authorization: Bearer`, never logged or returned; one shared throttled client (1 request/s) for both sources; 202/429 retried after the wait asked for; caching (search 1 day, games 7 days in DB + edge); searches only after a 0.5 s pause; previews, their companies and galleries stay on the exception (official API has none), game details and geeklists move to the official API. | ✅ |

**Post-design re-check** (after Phase 1): all ✅. New ADR 0007 (Proposed) records the per-kind source
choice; it supersedes ADR 0005's selection rule and keeps its adapter.

## Project Structure

### Documentation (this feature)

```text
specs/006-bgg-xml-search/
├── spec.md, design.md, design/prototype.html
├── plan.md              # this file
├── research.md          # Phase 0 (R1–R10)
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/api.md     # /api/bgg/search, /api/me, upstream XML endpoints
├── contracts/ui.md      # UI contract for tests
└── tasks.md             # /speckit-tasks
docs/adr/0007-bgg-source-per-kind-of-data.md   # NEW (Proposed), supersedes 0005's selection rule
```

### Source Code (repository root)

```text
worker/
├── bgg/cache.ts            # client: getText/getXml beside getJson, optional Authorization header,
│                           #   202 → retry (max 3, 2 s apart), 401/403 → bgg_unavailable + reason; TTL.search
├── bgg/xml.ts              # NEW fast-xml-parser setup, entity decoding, arrays for repeated tags
├── bgg/official.ts         # NEW OfficialSource: getGames (thing?stats=1, 20 ids per call),
│                           #   search (search?type=boardgame,boardgameexpansion), geeklist pages (xmlapi geeklist)
├── bgg/routing.ts          # NEW pickSource(env, deps): token → { games, search, geeklist: official;
│                           #   preview, companies, gallery: geekdo } else geekdo for all
├── bgg/source.ts           # BggSource.search returns SearchResult[]; fetchLimit per source
├── routes/search.ts        # NEW GET /api/bgg/search?q=&limit= (2–100 chars, limit 1–50)
├── routes/games.ts         # MAX_FETCH from the source (geekdo 10, official 40)
└── index.ts                # wire search route; one shared client for both sources
src/domain/
└── bgg-search.ts           # NEW searchQuery (trim, 2–100), rankResults (exact, prefix, rest; shorter name
                            #   first), parseGameInput (link | name | empty)
src/client/
└── api.ts                  # searchGames(q, limit, signal)
src/app/
├── hooks/useBggSearch.ts   # NEW 0.5 s debounce, AbortController + sequence (newest wins), states
├── screens/Search.tsx      # field, status line, results, empty/error notes; no ActionBar
├── components/
│   ├── SearchResultRow.tsx # NEW row button + big +; compact variant without +
│   ├── GameInfoSheet.tsx   # NEW cover (ImageViewer), info box, description, Close
│   ├── AddToCollectionsSheet.tsx # NEW ticks + category, reuses MembershipSheet's Pick/note
│   ├── AddGameSheet.tsx    # one field: name → matches, link → as before; Found game card with Change
│   └── GameLinkFields.tsx  # link parsing kept; label/UI moved into AddGameSheet's one field
├── actions.ts              # addToCollections(game, before, after, mark) (shared with list membership)
└── theme/search.css        # NEW result rows, status line, notes, found card
tests/
├── fixtures/bgg-xml/       # NEW recorded thing, search, geeklist (202 and 200) responses
├── worker/bgg-official.test.ts, bgg-routing.test.ts, search-route.test.ts   # NEW
├── unit/bgg-search.test.ts # NEW
└── e2e/search.spec.ts, add-game-name.spec.ts   # NEW
```

**Structure Decision**: same single-Worker web app; new code sits beside the existing adapter
(`worker/bgg/`), domain (`src/domain/`) and UI (`src/app/`).

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|---|---|---|
| `fast-xml-parser` dependency | the official API answers XML; Workers have no `DOMParser` | a regex reader breaks on entities, CDATA-like descriptions and attribute order (R3) |
| Two sources at once | the official API has no previews, companies or galleries; constitution V allows the exception only for those | one source would either break previews or keep using website data the official API offers |
