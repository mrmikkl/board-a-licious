# Quickstart: BGG Game Collection

Re-planned 2026-10-17. Commands become real once the corresponding tasks exist.

## One-time setup

1. **BGG**: apply for an application token at `boardgamegeek.com/applications` (needed for 1.0;
   0.5 runs without it).
2. **Neon**: create a free project; copy the connection string.
3. **Cloudflare**: Hyperdrive config for Neon; Zero Trust (Free) with an Access application for the
   Worker's hostname, policy "allow" with the friends' emails; login method one-time PIN (0.5),
   Zitadel added in 1.0.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars        # DEV_USER_EMAIL, DATABASE_URL (local), BGG_TOKEN (optional)
npm run db:migrate                    # migrations/*.sql
npm run dev                           # Vite + Worker on http://localhost:5173
```

Locally there is no Access; the Worker uses `DEV_USER_EMAIL` only when `ENVIRONMENT=development`.

## Tests

```bash
npm test                                  # Vitest: domain, client, Worker (BGG fixtures, PGlite)
npx vitest run tests/unit/filter.test.ts  # single test file
npm run test:e2e                          # Playwright 360×740 + axe; also a reduced-motion run
```

No test calls the live BGG site.

## Deploy

```bash
npm run db:migrate                    # against Neon
npm run deploy                        # wrangler deploy (assets + /api)
```

## Validation scenarios (phone, deployed)

| # | Scenario | Expected |
|---|---|---|
| 1 | Open the URL in a private window | Access login; no app content (SC-007) |
| 2 | First sign-in | Intro (3 cards), skippable (FR-027) |
| 3 | + → Collection "Essen 2026", Essen on | Card with Essen badge; empty collection with both add buttons (US1) |
| 4 | Collection → Add by link → `boardgamegeek.com/boardgame/295947/cascadia` | Under "Not yet marked", name "Cascadia", back in the collection; < 20 s (SC-001) |
| 5 | Mark it Must Have | Burst, dice sound, moves to Must Have; ≤ 2 taps (SC-003) |
| 6 | + → List → `boardgamegeek.com/geekpreview/93/…` | "SPIEL Essen 2026" with Essen badge, first games with booth and price < 10 s, publishers filled in shortly after, progress for the rest (SC-002) |
| 7 | Open a preview game, tick Essen and a standard collection, Done | In both; facts only in Essen (US2, FR-010) |
| 8 | Collection → Add from list → swipe 20 games | Right → Not yet marked, left → Not interested; none offered twice; ≥ 15/min (SC-011) |
| 9 | Filter preset "Must Have, not bought"; Bought it at €52 | Stamp; game stays in Must Have with "✅ €52"; disappears from the preset view; "€52 spent" (US4) |
| 10 | Game without facts → Add booth, price and publisher | Shown with "Added by you" (FR-011) |
| 11 | Airplane mode: mark, buy, reload; back online | Everything visible offline; synced afterwards (SC-004) |
| 12 | Second device | Same collections (FR-022) |
| 13 | Share Must Haves to WhatsApp | Text with booths, prices, ✅ for bought; < 15 s (SC-008) |
| 14 | Export backup, delete a collection, import | Collection restored (SC-009) |
| 15 | Search tab | "Comes soon" note, link to add by link (FR-019) |
| 16 | 360 px, axe, reduced motion | No horizontal scroll, no violations, no animations (SC-006, FR-024/026) |
| 17 | Rename a collection; delete another one and confirm | New name everywhere, type unchanged; deleted collection and its games gone on both devices (FR-001a) |
| 18 | Buy one game at €52 and one with a USD listed price at $40 | Bought line shows "€52 + $40 spent" (FR-008) |
| 19 | Fresh account without collections: + → Game → paste a link | Offered to create "SPIEL 2026" (Essen) first, then the game is in it (FR-016) |

Details: [contracts/api.md](contracts/api.md), [contracts/share-and-backup.md](contracts/share-and-backup.md),
[data-model.md](data-model.md), design: [design.md](design.md).
