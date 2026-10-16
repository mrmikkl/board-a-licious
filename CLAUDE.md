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

- Look and feel: `docs/design.md` (design rules v1.0.0) is binding for every UI change; the
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

- Features live in `specs/<NNN>-<short-name>/` (sequential numbering) with `spec.md`, `plan.md`,
  `tasks.md`; task IDs in `tasks.md` (`T001`, …) are what commit prefixes refer to.
- The active feature comes from `SPECIFY_FEATURE` or `.specify/feature.json`.
- Helper scripts are in `.specify/scripts/bash/`; templates in `.specify/templates/` are resolved
  via `resolve-template.sh` and must not be edited when filling in artifacts.

## Commands

No build, lint or test commands exist yet. Add them here once the first plan picks a stack.
