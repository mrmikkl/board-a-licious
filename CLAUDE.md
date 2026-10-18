# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Board-a-licious is a mobile-first web app for a small group of friends going to SPIEL Essen. Each
person keeps collections (Essen or standard) of BoardGameGeek games, fills them from geeklists by
swiping, marks games (Must Have, Interested, Unsure, Poop, Not interested), ticks them off as bought
with the price paid, and shares lists as text. Vision: `docs/vision.md`. No application code exists
yet; the clickable prototype is `specs/001-bgg-game-collection/design/prototype.html`.

Planned stack (`specs/001-bgg-game-collection/plan.md`): TypeScript, React + Vite SPA and `/api` in
one Cloudflare Worker; Neon PostgreSQL via Hyperdrive; IndexedDB + outbox for offline; Cloudflare
Access (Zitadel login) in front; shared pure domain logic in `src/domain/`.

## Rules that apply to all work

- Look and feel: `docs/design.md` (design rules v1.8.0) is binding for every UI change; the
  feature's screens are in `specs/<NNN>/design.md`.
- Project principles (mobile-first and accessible, test-first, domain logic separate from the UI,
  YAGNI, respectful BGG integration): `.specify/memory/constitution.md`. Plans and reviews check
  compliance against it.
- Commit messages: `docs/commit-conventions.md` (emoji + past-tense verb, `F<NNN> T<id>:` prefix
  for Spec Kit feature work).

## Spec Kit workflow

Development is spec-driven with Spec Kit (v1.2.1.dev0, installed as skills in `.claude/skills/`):
constitution → specify → (clarify) → plan → tasks → implement. `/speckit-help` shows all commands
and recommends the next one from the repo's current state. Basics: `docs/speckit.md`.

We run an extended flow, `docs/speckit-extended.md`; apply it whenever a `/speckit-*` command runs:

- **Extension 1, ADRs**: `/speckit-plan` reads accepted ADRs in `docs/adr/` first and writes new
  (Proposed) or superseding ADRs for decisions that bind later features.
- **Extension 2, Design**: between specify/clarify and plan, build a clickable prototype, review it
  with the user, and record rules in `docs/design.md` and `specs/<NNN>/design.md`; later steps
  follow them.
- **Extension 3, Several features ahead**: one branch (and, in parallel, one worktree) per feature;
  number new features after the highest `NNN-*` branch, not just the folders in `specs/`.

- Features live in `specs/<NNN>-<short-name>/` (sequential numbering) with `spec.md`, `plan.md`,
  `tasks.md`; task IDs in `tasks.md` (`T001`, …) are what commit prefixes refer to.
- The active feature comes from `SPECIFY_FEATURE` or `.specify/feature.json`.
- Helper scripts are in `.specify/scripts/bash/`; templates in `.specify/templates/` are resolved
  via `resolve-template.sh` and must not be edited when filling in artifacts.

## Commands

```bash
npm install
cp .dev.vars.example .dev.vars   # local settings (DEV_USER_EMAIL, DATABASE_URL)
npm run db:local                 # local PostgreSQL via PGlite on :5432 (keep running)
npm run dev                      # Vite + Worker on http://localhost:5173
npm test                         # Vitest: unit (domain, client) and worker projects
npx vitest run tests/unit/marks.test.ts   # one test file
npm run test:e2e                 # Playwright at 360×740 (+ reduced motion), axe
npm run build                    # tsc + vite build (app, service worker, Worker)
npm run deploy                   # build + wrangler deploy
```

## Code layout

- `src/domain/`: pure TypeScript rules shared by app and Worker (marks, collections and merge, …).
- `src/client/`: browser adapters: `store.ts` (IndexedDB, one database per signed-in email, outbox),
  `api.ts` (fetch wrapper, `ApiError`), `sync.ts` (push outbox, pull since last sync).
- `src/app/`: React UI; `theme/*.css` holds the design tokens of `docs/design.md`; hash router in
  `router.ts`; `context.tsx` boots the store and sync for the signed-in person.
- `worker/`: `index.ts` (`createApp(deps)` router, testable with injected auth/db/clock), `auth.ts`
  (Access JWT), `db/` (repository, SQL last-write-wins), `bgg/` (cached, throttled BGG client).
- Worker tests run in Node with PGlite and fakes, not in workerd. Pass arrays to SQL as PostgreSQL
  array literals (`pgArray`): the production `postgres` driver does not serialise JS arrays.
