# 0001. Record architecture decisions

- **Status**: Accepted
- **Date**: 2026-10-16
- **Origin**: discussion during the plan of `specs/001-bgg-game-collection`

## Context

Spec Kit records technical decisions only per feature, in `specs/<NNN>/research.md`. Later features
see earlier decisions only through the code, without the reasons or the rejected alternatives, and
nothing stops a new plan from silently contradicting an earlier choice.

## Decision

We keep Architecture Decision Records in `docs/adr/`. A decision becomes an ADR when it affects
more than the feature that raised it (hosting, storage, auth, integrations, core libraries,
cross-cutting patterns). Feature research links to the ADR instead of repeating it.

## Consequences

- `/speckit-plan` reads accepted ADRs before deciding anything, and writes new or superseding ADRs
  as part of the plan (extension 1 in `docs/speckit-extended.md`).
- Slightly more writing per plan; in return each later feature starts from documented decisions.

## Alternatives considered

- **Only feature `research.md`**: decisions get lost between features.
- **One architecture document**: harder to see when and why something changed; ADRs keep history.
