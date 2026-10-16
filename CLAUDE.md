# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Board-a-licious is a mobile-first web app for a small group of friends. It searches BoardGameGeek
(generally or within a geeklist, e.g. the Spiel 26 Preview) and keeps a shared collection of
marked games, each with a state such as "Interested", "Must Have" or "Poop", for use at the Spiel
fair. No application code exists yet.

Planned stack (`specs/001-bgg-game-collection/plan.md`): TypeScript, React + Vite SPA and `/api` in
one Cloudflare Worker; Neon PostgreSQL via Hyperdrive; IndexedDB + outbox for offline; Cloudflare
Access (Zitadel login) in front; shared pure domain logic in `src/domain/`.

## Rules that apply to all work

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
