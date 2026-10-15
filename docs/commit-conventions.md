# Commit conventions

Binding for every commit in this repo, whether a person or Claude Code writes it.
Agents and commands point here instead of carrying their own copy.

## The shape

```
[F<feature>[ <task>]: ]<emoji> <verb> <rest of the sentence>

<optional body>
```

- **Prefix.** `F<feature>` when the commit belongs to a Spec Kit feature, plus
  `<task>` when it belongs to one task of it, then a colon. No prefix for work
  outside a feature. The feature number is the three-digit number in the folder
  name `specs/<NNN>-<name>/`; the task is its ID in that feature's `tasks.md`
  (`T001`, `T002`, …).
- **Emoji.** Exactly one, from the table below. It fixes the verb.
- **Sentence.** Starts with the emoji's verb in the past tense, lowercase, no
  full stop. It says what is true after the commit, not what you did on the way.
  Aim for about 72 characters; detail goes in the body.

Merges keep the message git writes.

## Emoji and verb

| Emoji | Verb | Use for | Example |
|---|---|---|---|
| ✨ | added feature to / for | new behaviour or content | ✨ added feature for geeklist search |
| 🐛 | fixed | a bug | 🐛 fixed the state picker so it closes after a tap |
| ♻️ | refactored | structure changes, behaviour stays | ♻️ refactored the BGG client behind a gateway interface |
| 📝 | documented | docs and spec files only | 📝 documented the commit conventions |
| 🧪 | tested | tests only | 🧪 tested collection states against BGG fixtures |
| 💄 | styled | visual-only changes | 💄 styled game cards for 360px screens |
| ⚡ | sped up | performance | ⚡ sped up search by caching BGG responses |
| 🔧 | configured | config, tooling, dependencies | 🔧 configured Spec Kit for Claude Code |
| 👷 | built CI | pipeline and CI jobs | 👷 built CI step that runs the unit tests |
| 📦 | packaged | build, deployment | 📦 packaged the app as a static build |
| 🔥 | removed | deleting code, files or features | 🔥 removed the unused demo page |
| ⏪ | reverted | undoing an earlier commit | ⏪ reverted the search caching |

## Feature commits

```
F<feature> <task>: <emoji> <sentence>

<which files changed, what was added or modified, notable decisions>
```

Pick the emoji by the task's intent; when in doubt, ✨. Several tasks done
together take the feature prefix without a task.

```
F001 T012: ✨ added feature for marking games as "Must Have"

- src/domain/collection.ts: state transitions for Interested / Must Have / Poop
- tests/domain/collection.test.ts: transition and persistence tests
- specs/001-bgg-collection/tasks.md: T012 ticked
```

## Spec Kit steps

Each Spec Kit step that produces artifacts leaves one commit with 📝:

| Step | Subject |
|---|---|
| Constitution | 📝 documented the constitution v<version> |
| Specify | F<feature>: 📝 documented the spec for <name> |
| Clarify | F<feature>: 📝 documented clarifications for <name> |
| Plan | F<feature>: 📝 documented the plan for <name> |
| Tasks | F<feature>: 📝 documented the tasks for <name> |

## Other commits on a feature branch

A fix or chore on a feature branch that belongs to no single task takes the
feature prefix without a task:

```
F001: 🐛 fixed the BGG fixture loader so it reads UTF-8
```
