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
orca orchestration run-create --objective "F002: implement US1–US3" --json        # → run id
orca orchestration task-create --task-title "F002 A: share sheet" --display-name "F002 A: share sheet" \
  --spec "$(cat brief-a.md)" --json                                                   # → task id
orca orchestration worker-start --task <task> --worktree new-child --name f002-worker-a-sheet \
  --base-branch NNN-<short-name> --setup skip --agent claude --json                   # → dispatch id
```

- Start each worker with its own call (in zsh, one command per line, no loops over arrays).
- `--setup skip`: no setup script runs in the new worktree; if the worker needs `node_modules`,
  its brief tells it to run `npm install` first.

### 4. Coordinate

- Wait for events in the background:
  `orca orchestration check --run <run> --wait --types worker_done,escalation,question --json`
  (one waiter per run at a time); acknowledge each batch with `--ack <deliveryId>`. Heartbeats
  ("alive") arrive in between and need no action.
- Answer questions with `orca orchestration reply --run <run> --id <msg_id> --body "…"`.
- A worker that goes quiet usually waits for a permission prompt: look with
  `orca orchestration worker-read --dispatch <dispatch> --source terminal` (or `--source transcript`) and tell the user which prompt to approve
  (never approve on their behalf).

### 5. Merge (per finished worker)

1. Review its diff against the feature branch: scope (only its files), tests added, conventions.
2. `git merge --no-ff <worker-branch>` into the feature branch; resolve conflicts (usually import
   or route lines).
3. Type-check, all unit and worker tests, all e2e tests.
4. Tick its tasks in `tasks.md` and commit.

### 6. Clean up

```bash
orca orchestration worker-release --dispatch <dispatch>
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

## Lessons from F002

- New worktrees have no `node_modules`: every worker first asks to run `npm install` (a permission
  prompt the user approves in the worker's terminal).
- The dev server on :5173 serves the main checkout, not a worker's worktree: workers that run e2e
  tests start their own Vite on another port with a local, uncommitted Playwright config.
- Tests that need another worker's part: each worker asserts only what it owns; the coordinator runs
  all suites together after merging (and enables any test left pending).

## Lessons from F003

- The local database (`npm run db:local`, PGlite) serves one connection at a time. After a full
  e2e run it can keep a connection whose client is gone; every later request then hangs (sync tests
  time out: `offline`, `share-offline` sync, `lists-sync`, `share-hint` just-added). `idleTimeout`
  does not free it. Fix for now: stop it with `kill -9` (a normal stop waits on the stuck
  connection) and start `npm run db:local` again; run those sync specs on their own after a fresh
  start. Dev servers left over from earlier workers also hold connections: stop them when cleaning up.
- With ~2,000 test collections in the local database, `lists-sync` times out at its first
  `/api/sync` poll during a run (the request waits behind the app's own sync for the one
  connection), although the same request answers at once afterwards. A smaller local database
  (fresh `.pglite/`) is the fix; it is not a code failure.
- A fresh local database fixed most of it: move `.pglite/` aside and start `npm run db:local`
  again (migrations run on start). After that the full suite passed except `offline.spec.ts`,
  which also fails about 1 in 4 runs on `main` (its sync after going back online is timing-bound).

