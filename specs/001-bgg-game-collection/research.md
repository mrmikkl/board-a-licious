# Research: BGG Game Collection

> **Status**: Outdated. Written before the design session of 2026-10-17, which reshaped the spec
> (several collections, Essen type, facts, swiping, marks incl. Unsure / Not interested, bought with
> price, filter). Re-run `/speckit-plan`; accepted ADRs in `docs/adr/` stay valid.

Decisions taken during `/speckit-plan` (2026-10-16). Project-wide decisions are recorded as ADRs in `docs/adr/`:
R1/R2 → [0004](../../docs/adr/0004-storage-neon-local-first.md), R3 → [0003](../../docs/adr/0003-access-control-cloudflare-access.md),
R4/R4a → [0005](../../docs/adr/0005-bgg-adapter-and-bridge.md), R5 → [0002](../../docs/adr/0002-single-cloudflare-worker.md), R6/R8 → [0006](../../docs/adr/0006-typescript-react-shared-domain.md). Items marked **verify** rest on secondary
sources or on knowledge that could not be checked against the vendor's own page.

## R1. Where the collection lives

- **Decision**: PostgreSQL on **Neon Free**, reached from the Worker through **Cloudflare
  Hyperdrive**. The browser keeps a local copy (IndexedDB) for offline use.
- **Rationale**: The user asked for a free PostgreSQL if one exists. Neon Free (verified on
  neon.com/pricing, 2026-10-16): permanent, no credit card, 1 GB storage and 100 CU-hours per
  project, scale-to-zero after 5 minutes idle (not configurable), 6 h restore window. Hitting the
  compute limit suspends compute until the next period; exceeding storage blocks writes; no data is
  deleted. A few friends' collections are far below these limits. Hyperdrive Free (verified on
  Cloudflare docs): 100,000 queries/day (reset 00:00 UTC, further queries fail), ~20 origin
  connections, 10 configs; it pools connections, which cuts latency from the edge.
- **Alternatives considered**:
  - *Browser only* (original user input): no server state, but a lost phone loses the collection.
  - *Supabase Free*: pauses projects after a week without activity, risky in the weeks before the
    fair.
  - *Cloudflare D1* (SQLite): simpler, no extra vendor, but not PostgreSQL as requested.
- **Caveats**: Neon's free restore window is only 6 h, so the user-held backup file (FR-017) stays
  useful. A community note (unverified) says Neon's serverless (WebSocket) driver bypasses
  Hyperdrive's pooling, so a TCP driver (`postgres`) is used.

## R2. Offline behaviour and sync

- **Decision**: Local-first. Every state change is written to IndexedDB immediately and appended to
  an outbox; the outbox is sent to the server when online (on change, on `online`, on app start).
  Conflicts are resolved per game by **last write wins** on the client's `updatedAt`; removals are
  tombstones so they sync like any other change. A service worker caches the app shell.
- **Rationale**: Meets FR-011/SC-004 (collection usable with no network) with the simplest
  reliable merge rule for one person on a few devices.
- **Alternatives considered**: CRDT/sync libraries (overkill for one record per game); server-only
  (fails offline at the fair).

## R3. Access control

- **Decision**: **Cloudflare Access** (Zero Trust Free, up to 50 users) protects the whole app
  hostname. Login method: **Zitadel Cloud** via Access's generic OIDC connector. Policy: allow
  listed email addresses only. The Worker additionally validates the `Cf-Access-Jwt-Assertion`
  JWT (signature via the team's JWKS, `aud`, `exp`) and uses the verified `email` as the user key.
- **Rationale**: Nothing is served before sign-in (FR-013, SC-007); no login code or tokens in the
  app; the session cookie is HttpOnly. Validating the JWT in the Worker means a misconfigured
  route still cannot read data.
- **Alternatives considered**:
  - *In-app OIDC (react-oidc-context + jose)*: more code, static assets stay public, and iframe
    silent renew breaks in iOS Safari. Kept for a future feature that needs roles.
  - *Self-hosted Keycloak*: cannot run on Cloudflare; a server to patch for < 10 users.
  - *Access one-time PIN* (email code, no Zitadel): even simpler; stays as a fallback login
    method if Zitadel setup blocks.
- **Caveats**: Cloudflare's setup docs (verified) require payment details during Zero Trust
  onboarding even on the Free plan ("you will not be charged"). The 50-user free cap comes from
  Cloudflare's older Teams blog post plus third-party summaries; Cloudflare's current plan page did
  not state it. Zitadel Free (verified on zitadel.com/pricing): 100 daily active users, 3 identity
  providers; whether sign-up needs a credit card is not stated officially (one directory says yes).
  No source confirmed a Zitadel-specific Access guide;
  the generic OIDC connector (redirect `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`)
  applies to any standard OIDC provider.

## R4. BoardGameGeek access

- **Decision**: All BGG calls go through the Worker, which adds the application token
  (`Authorization: Bearer …`, stored as a Worker secret) and caches responses with the Workers
  Cache API.
  - Search: XML API2 `search?query=…&type=boardgame,boardgameexpansion`
  - Game details/thumbnails: XML API2 `thing?id=…` (batched)
  - Geeklist: XML API v1 `geeklist/{id}` (verify: no v2 equivalent)
- **Rationale**: BGG requires a registered application and bearer token for the XML API; approval
  can take a week or more, so registration is the first setup step. The token must never reach the
  browser (constitution: no secrets in client). Caching satisfies FR-015 and Principle V.
- **Cache TTLs**: search 1 h, thing 24 h, geeklist 1 h.
- **Error handling**: BGG may answer `202` while preparing a geeklist and `429` when rate-limited;
  the Worker retries `202` a few times with back-off and passes `429`/`5xx` to the client as a
  retryable error (FR edge cases).
- **Verified 2026-10-16**: unauthenticated requests to `xmlapi2/search` and `xmlapi/geeklist`
  return `401`, so the token is mandatory. BGG offers no other public (JSON/REST) API; the XML API
  is its HTTP API. Undocumented JSON endpoints used by BGG's own website are rejected: not covered
  by the terms (Principle V) and may change without notice.
- **Schedule risk**: SPIEL Essen 2026 runs 2026-10-22 to 2026-10-25; BGG says approval may take a
  week or more, so the token may arrive during or after the fair. Development proceeds against
  hand-written fixtures until real responses can be recorded.
- **Caveats** (verify): the official "Using the XML API" page returned 403 to automated fetches.
  Per-request limits for `thing` IDs, exact rate limits and any attribution requirements
  ("Powered by BGG") must be read from the BGG applications page after registration.

## R4a. Release 0.5: working before the BGG token

- **Decision**: Release 0.5 reads BGG's public website JSON (`api.geekdo.com`, no token) through
  the Worker, under the time-limited exception in constitution v1.1.0 (Principle V). Search covers
  only geeklists loaded on the device. Games can also be added by pasted link.
- **Tested 2026-10-16** (from a home connection, honest app User-Agent accepted):
  - `GET /api/geekitems?objectid=<id>&objecttype=thing&nosession=1` → 200; name, year, image URLs.
  - `GET /api/geeklists/<id>` → 200; list title.
  - `GET /api/listitems?listid=<id>&page=<n>` → 200; 25 entries per page with item id, name, type,
    href, image id; `pagination.total` (the 2026 auction list has 18,306 items = 733 pages).
  - No CORS headers → the browser cannot call it directly; the Worker proxies and caches.
  - Name search: BGG site search → 403 (bot challenge); `/api/search` → 404. No token-free search.
- **Geeklist loading**: the client fetches pages one by one through the Worker (cached 1 h), shows
  the first page at once and loads the rest in the background with progress, storing entries in
  IndexedDB so search works offline (FR-020).
- **Risks**: undocumented, may change without notice; may be blocked from Cloudflare's network
  (spike first); BGG's terms for this data are unclear (hence the time-limited exception).
- **Evidence it is workable**: the user's own `essen-list-games` / `essen-sell-game` skills use
  the same endpoints and matched a third-party tool on 49 of 49 auction entries (2026-10-15).
- **Alternatives considered**:
  - *Self-hosted SearXNG for name search*: needs its own server (cannot run on Cloudflare); free
    hosts sleep or are unreliable; Google/Bing/DuckDuckGo throttle or block datacenter IPs, so it
    may fail at the fair; another service to secure (Principle IV).
  - *Company LiteLLM gateway + Qwen*: the model cannot search without a search backend, and using
    company infrastructure for a private app is not wanted.
  - *Scraping BGG HTML pages*: blocked by bot protection and excluded by the exception's terms.
  - *Web Share Target from BGG into the app*: Android only, not iOS Safari; possible later.

## R5. Hosting shape

- **Decision**: One **Cloudflare Worker with static assets** serves the SPA and `/api/*`, instead of
  Pages plus a separate Worker.
- **Rationale**: One deploy, one config, one hostname behind Access; Hyperdrive and secrets bind to
  the same Worker. Cloudflare steers new full-stack projects to Workers static assets (verify).
- **Alternatives considered**: Pages + Pages Functions (equivalent; switch if preferred), Pages +
  separate Worker (two deploys and cross-origin calls).

## R6. Frontend stack

- **Decision**: TypeScript, React 19 + Vite, `vite-plugin-pwa` (Workbox) for the service worker,
  `idb` for IndexedDB, plain CSS with custom properties. No component library.
- **Rationale**: Small, well-known, matches the stack in the user's earlier auth prompt. A
  component library adds weight without a current need (Principle IV).

## R7. Sharing and backup

- **Decision**: Share uses the Web Share API (`navigator.share({ text })`), falling back to the
  clipboard. Backup is a versioned JSON file, downloaded via a Blob; import reads a file input.
- **Rationale**: Plain text reads well in WhatsApp/Signal and needs no app; JSON keeps exact states
  and timestamps for a lossless restore (SC-009). Formats: `contracts/share-and-backup.md`.

## R8. Testing

- **Decision**: Vitest for domain and client logic; `@cloudflare/vitest-pool-workers` for Worker
  routes with recorded BGG XML fixtures; PGlite (Postgres in WASM) for repository tests without
  Docker; Playwright at a 360×740 viewport with `@axe-core/playwright` for e2e and WCAG checks.
  Access is bypassed in local dev by a dev-only fixed identity; the JWT check itself is unit-tested.
- **Rationale**: Principle II (test-first, BGG via fixtures, never live) and Principle I (phone
  width, WCAG 2.2 AA).

## Sources

- [Neon pricing (official)](https://neon.com/pricing), [Neon pricing in 2026 (jetadmin)](https://www.jetadmin.io/blog/neon-pricing/amp/),
  [selfhost.dev](https://selfhost.dev/neon-pricing-cost-of-serverless-postgres/),
  [devtoollab](https://devtoollab.com/blog/best-serverless-postgres)
- [Hyperdrive on the Free plan (Cloudflare changelog)](https://developers.cloudflare.com/changelog/2025-04-08-hyperdrive-free-plan/),
  [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/),
  [Hyperdrive limits](https://developers.cloudflare.com/hyperdrive/platform/limits/),
  [Hyperdrive driver note (community)](https://agentpedia.codes/agent-skills/database/cloudflare-hyperdrive)
- [Cloudflare Access generic OIDC](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/index.md),
  [Cloudflare Teams plans (50 free users)](https://blog.cloudflare.com/teams-plans),
  [Zero Trust setup (payment details)](https://developers.cloudflare.com/cloudflare-one/setup/)
- [Zitadel pricing](https://zitadel.com/pricing), [freetier.co on Zitadel](https://freetier.co/directory/products/zitadel)
- [BGG: Using the XML API](https://boardgamegeek.com/using_the_xml_api)
- [SPIEL Essen 2026 exhibitor info](https://www.spiel-essen.de/en/exhibit)
