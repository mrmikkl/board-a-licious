# Orca Swarm

How we implement one feature's tasks with several agents in parallel, using
[Orca](https://github.com/stablyai/orca)'s orchestration CLI. "Orca Swarm" is the short name: say it
and the agent runs the procedure below. It is one way to run `/speckit-implement`
([Spec Kit extended](speckit-extended.md), Extension 3), not a step of its own.

**When it pays off**: many open tasks that touch different files (several user stories, separate
screens, worker and client). For a handful of tasks, or tasks in the same files, one agent is
faster: merging and reviewing costs time too.

## Roles

- **Coordinator**: the agent session on the feature branch (`NNN-<short-name>`). It splits the
  work, starts and answers the workers, reviews and merges their work, runs all tests and cleans up.
- **Workers**: one agent each, in a worktree of its own branched from the feature branch. They
  never merge, push or edit `tasks.md`.
- **You**: approve the split (it spends tokens in parallel) and approve permission prompts in the
  workers' terminals when they ask.

## Procedure

### 1. Split

- Group the open tasks of `tasks.md` into blocks that **own separate files** (e.g. one user story's
  screens, the Worker routes, the domain module). A block lists its task IDs and the files it may
  change.
- If two blocks would edit the same file (a router, a shared type, `App.tsx`), the coordinator
  first commits a small **skeleton** on the feature branch (empty routes, stub types) so each block
  only fills in its part.
- Shared work that everything depends on (Setup, Foundational) is done first, before the swarm.
- Waves: up to 4–5 workers at a time; a later wave starts from the merged result of the earlier one.

### 2. Brief

One brief per worker, self-contained (the worker does not see the coordinator's conversation):

- the task IDs and their text, the files it owns and the files it must not touch;
- **tests first** (constitution: test-first), `npm test` green before reporting;
- follow `docs/design.md`, `docs/commit-conventions.md` (`F<NNN> T<id>: …`), `CLAUDE.md`;
- do not edit `tasks.md`; do not merge, push or deploy;
- report "done" through the orchestration when finished, ask through it when stuck.

### 3. Run

```bash
orca orchestration run-create --title "F002 wave 1"
orca orchestration task-create --run <run> --title "US1 share sheet" --brief-file brief-us1.md
orca orchestration worker-start --run <run> --task <task> \
  --worktree new-child --base-branch NNN-<short-name> --setup skip --agent claude
```

- Start each worker with its own call (in zsh, one command per line, no loops over arrays).
- `--setup skip`: no setup script runs in the new worktree; if the worker needs `node_modules`,
  its brief tells it to run `npm install` first.

### 4. Coordinate

- Wait for events in the background:
  `orca orchestration check --wait --types worker_done,escalation,question`; acknowledge each
  delivery.
- Answer questions with `orca orchestration reply`.
- A worker that goes quiet usually waits for a permission prompt: look with
  `orca orchestration worker-read --source terminal` and tell the user which prompt to approve
  (never approve on their behalf).

### 5. Merge (per finished worker)

1. Review its diff against the feature branch: scope (only its files), tests added, conventions.
2. `git merge --no-ff <worker-branch>` into the feature branch; resolve conflicts (usually import
   or route lines).
3. Type-check, all unit and worker tests, all e2e tests.
4. Tick its tasks in `tasks.md` and commit.

### 6. Clean up

```bash
orca orchestration worker-release --worker <worker>
orca worktree rm --worktree branch:<worker-branch> --force   # removes worktree and merged branch
git worktree list                                             # only the main folders remain
```

## Lessons from F001

- File ownership is what makes it work: the waves with clean ownership merged without conflicts;
  shared files needed a skeleton first.
- Workers stall on permission prompts more than on code; check their terminals early.
- Run the e2e suite after every merge, not only at the end: flaky timing showed up only in
  combination.
- Remove worktrees and branches right after merging; stale ones confuse later `git worktree list`
  and branch-based numbering (Extension 3).
