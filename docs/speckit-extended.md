# Spec Kit extended

Our version of Spec Kit: the [basic flow](speckit.md) plus two extensions that fill gaps the basic
flow leaves open.

| # | Extension | Gap in basic Spec Kit | Adds |
|---|---|---|---|
| 1 | Architecture Decision Records | Technical decisions live only in one feature's `research.md`; later features lose the reasons | `docs/adr/` |
| 2 | Design | Nothing defines how the app looks; the implementing agent decides on its own | clickable prototype, `docs/design.md`, `specs/<NNN>/design.md` |

## The extended flow

```mermaid
flowchart TD
    C["/speckit-constitution"]
    S["/speckit-specify"]
    CL["/speckit-clarify<br/><i>optional</i>"]
    D["<b>Ext 2: Design</b><br/>prototype → review → design rules"]
    P["/speckit-plan"]
    ADR["<b>Ext 1: ADRs</b><br/>read accepted ADRs,<br/>write new ones"]
    CH["/speckit-checklist<br/><i>optional</i>"]
    T["/speckit-tasks"]
    A["/speckit-analyze<br/><i>optional</i>"]
    I["/speckit-implement"]
    CO["/speckit-converge<br/><i>optional</i>"]

    C --> S --> CL --> D
    S --> D
    D --> P
    ADR <--> P
    P --> CH --> T
    P --> T
    T --> A --> I
    T --> I
    I --> CO --> I
    I -->|next feature| S

    classDef ext fill:#fff3cd,stroke:#d4a017,color:#000;
    class D,ADR ext;
```

All other steps of the basic flow appear unchanged; the three levels and the task phases stay as
described in [speckit.md](speckit.md).

## Extension 1: Architecture Decision Records

**Purpose**: decisions that outlive one feature are written down once, with reasons and rejected
alternatives, and every later plan has to respect them.

**Artifacts**: `docs/adr/NNNN-<title>.md` (template and rules in [docs/adr/README.md](adr/README.md)).

**Where it plugs in**: `/speckit-plan`, before and after research.

| When | What happens |
|---|---|
| Before research | Read all **Accepted** ADRs. Decisions they cover are not re-researched; the plan's Technical Context links them. |
| During research | For each decision in `research.md`, ask: does it bind later features too (hosting, storage, auth, integrations, core libraries, cross-cutting patterns)? If yes, write an ADR with status **Proposed** and link it from `research.md`. |
| Contradiction | A plan that needs to break an accepted ADR writes a new ADR that **supersedes** it, and says so in the plan's Complexity Tracking. |
| Approval | The user accepts or rejects proposed ADRs before `/speckit-tasks`; accepted ones switch to **Accepted** and are committed with the plan. |
| `/speckit-analyze` | Also checks spec, plan and tasks against accepted ADRs. |

**Rule of thumb**: feature-local choice → `research.md` only; anything a second feature would
have to know → ADR.

## Extension 2: Design

**Purpose**: the user defines how the app looks and feels before the plan and tasks are written,
so the implementation follows agreed rules instead of the agent's taste.

**Artifacts**:

| File | Scope | Content |
|---|---|---|
| Clickable prototype | per feature, throwaway | `specs/<NNN>/design/prototype.html`: a self-contained HTML page of the feature's screens, opened in a desktop browser and tested with the browser's device mode (phone sizes); optionally published as a private, shareable page |
| `docs/design.md` | whole project, like the constitution for the look | design rules: colours and states, typography, spacing, touch sizes, components, layout patterns, motion, light/dark mode, accessibility rules; versioned like the constitution |
| `specs/<NNN>/design.md` | one feature | screens and flows of the feature, prototype link, which components it uses, new components or rules it introduces |

**Where it plugs in**: after `/speckit-specify` (and `/speckit-clarify`), before `/speckit-plan`.

1. **Prototype**: build a clickable prototype from the spec's user stories, using existing
   `docs/design.md` rules if there are any. No real data or backend; realistic sample content.
2. **Review**: the user opens it in the browser, switches the developer tools to device mode
   (e.g. iPhone or a 360 px Android size), tries the flows and gives feedback; iterate until the
   look and the flows feel right. Changes to *what* the feature does go back into `spec.md`.
3. **Rules**: extract what was agreed into `docs/design.md` (new or amended, with a version bump)
   and write the feature's `specs/<NNN>/design.md`.
4. **Gate**: the user approves both files before `/speckit-plan`.

**Effect on the following steps**:

- `/speckit-plan` builds on `docs/design.md` (no component library or styling approach that
  contradicts it) and lists the feature's screens from `specs/<NNN>/design.md`.
- `/speckit-tasks` references screens and components by the names used in the design files.
- `/speckit-implement` follows `docs/design.md`; the prototype is a reference, not code to copy.
- `/speckit-analyze` also checks that every screen in the feature's `design.md` is covered by tasks.

## How the extensions are applied

The extensions are instructions, not new `/speckit-*` commands: `CLAUDE.md` points the agent to
this file, so it applies them when running the basic commands.
