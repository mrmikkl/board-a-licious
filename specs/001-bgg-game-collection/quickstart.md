# Quickstart: BGG Game Collection

> **Status**: Outdated. Written before the design session of 2026-10-17, which reshaped the spec
> (several collections, Essen type, facts, swiping, marks incl. Unsure / Not interested, bought with
> price, filter). Re-run `/speckit-plan`; accepted ADRs in `docs/adr/` stay valid.

How to run and validate the feature. Commands become real once the corresponding tasks exist.

## One-time setup (accounts)

1. **BGG**: register a non-commercial application at `boardgamegeek.com/applications`; after
   approval (can take a week or more) create a token. Do this first. Release 0.5 runs without it.
2. **Neon**: create a free project; copy the connection string.
3. **Cloudflare**: create a Hyperdrive config pointing at Neon; enable Zero Trust (Free).
4. **Release 0.5 login**: in Zero Trust → Settings → Authentication, enable "One-time PIN".
   **Release 1.0**: **Zitadel Cloud**: create a project and a web application (confidential, code flow) with
   redirect URI `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`; add it in Zero Trust
   → Settings → Authentication as an OpenID Connect login method.
5. **Access application**: self-hosted app for the Worker's hostname, policy "Allow" with the
   friends' email addresses; copy the application AUD tag.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # BGG_TOKEN, DEV_USER_EMAIL, local DB URL
npm run db:migrate                    # applies migrations/*.sql to DATABASE_URL
npm run dev                           # Vite + Worker (wrangler) on http://localhost:5173
```

Locally there is no Access; the Worker uses `DEV_USER_EMAIL` only when `ENVIRONMENT=development`.

## Tests

```bash
npm test                              # Vitest: domain, client, Worker (BGG fixtures, PGlite)
npx vitest run tests/unit/share.test.ts   # single test file
npm run test:e2e                      # Playwright at 360×740 + axe accessibility checks
```

No test calls the live BGG API.

## Deploy

```bash
npx wrangler secret put BGG_TOKEN
npm run db:migrate                    # against the Neon URL
npm run deploy                        # wrangler deploy (assets + /api)
```

Worker vars: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`; binding `HYPERDRIVE`.

## Validation scenarios (on a phone, deployed)

| # | Scenario | Expected |
|---|---|---|
| 1 | Open the app URL in a private window | Access login page; no app content (SC-007) |
| 2 | Sign in with an invited email (one-time PIN in 0.5, Zitadel in 1.0) | App opens; in 0.5 the search screen says it searches loaded geeklists only |
| 2b | Paste `https://boardgamegeek.com/boardgame/295947/cascadia`, pick "Must Have" (US1) | Added as "Cascadia" with link and placeholder image; works with no BGG token (SC-010) |
| 3 | Release 1.0: search "Cascadia", mark "Must Have" (US3) | Game in collection with state; < 20 s (SC-001) |
| 4 | Paste Spiel 26 Preview geeklist URL, mark 3 games (US2) | First entries fast, rest load with progress; states shown; reopen from recent lists |
| 4b | Airplane mode, search a game name from the search screen (US2, FR-020) | Matches from loaded geeklists; < 15 s to find and mark (SC-010) |
| 5 | Filter collection by "Must Have", change one to "Poop", remove one (US4) | Counts update; changes survive reload |
| 6 | Airplane mode, change two states, reload, go online (SC-004) | Collection visible offline; changes on server after reconnect |
| 7 | Sign in on a second device | Same collection (FR-012) |
| 8 | Share "Must Have" to WhatsApp (US5) | Text grouped by state with working links; < 15 s (SC-008) |
| 9 | Export backup, delete all games, import backup (SC-009) | Collection identical |
| 10 | Import a random JSON file | Clear error; collection unchanged |
| 11 | Everything at 360 px width | No horizontal scroll; axe reports no WCAG 2.2 AA violations (SC-006) |

Details: [contracts/api.md](contracts/api.md), [contracts/share-and-backup.md](contracts/share-and-backup.md),
[data-model.md](data-model.md).
