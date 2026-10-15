---
name: speckit-help
description: Show a compact overview of all spec-kit commands and recommend which one to run next based on the project's current spec-kit state.
---

Print this table as-is:

| # | Command | What it does |
|---|---------|--------------|
| 1 | `/speckit-constitution` | Define project principles (`.specify/memory/constitution.md`) |
| 2 | `/speckit-specify <idea>` | Write a feature spec (`specs/NNN-*/spec.md`) |
| 3 | `/speckit-clarify` | Ask ≤5 questions to close gaps in the spec *(optional)* |
| 4 | `/speckit-plan <tech>` | Technical plan + design artifacts (`plan.md`) |
| 5 | `/speckit-checklist` | Custom quality checklist for the feature *(optional)* |
| 6 | `/speckit-tasks` | Dependency-ordered `tasks.md` |
| 7 | `/speckit-analyze` | Consistency check across spec/plan/tasks *(optional)* |
| 8 | `/speckit-implement` | Execute the tasks |
| 9 | `/speckit-converge` | Add tasks for anything still unbuilt *(optional)* |
| – | `/speckit-taskstoissues` | Tasks → GitHub issues *(deprecated)* |

Then determine the next step by checking, in order:

1. `.specify/memory/constitution.md` still contains `[PROJECT_NAME]` / `[PRINCIPLE_` placeholders → recommend `/speckit-constitution`.
2. No `specs/*/spec.md` → recommend `/speckit-specify`.
3. Latest feature dir (highest `specs/NNN-*`, or the one matching the current git branch) has `spec.md` with `[NEEDS CLARIFICATION` markers and no `## Clarifications` section → `/speckit-clarify`.
4. No `plan.md` → `/speckit-plan`.
5. No `tasks.md` → `/speckit-tasks`.
6. `tasks.md` has unchecked `- [ ]` items → `/speckit-implement` (suggest `/speckit-analyze` first if it was never run).
7. Everything checked → `/speckit-converge` to verify nothing is missing, or start the next feature with `/speckit-specify`.

Output one line: **Next:** `<command>` — <one-sentence reason>. If the command needs an argument, include a short example tailored to this project.
