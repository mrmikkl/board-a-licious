# Board-a-licious Constitution

## Core Principles

### I. Mobile-First & Accessible

Board-a-licious is a web app used mostly on smartphones, often one-handed on a busy fair floor.

- Every screen MUST be designed for a ~360px-wide viewport first; larger layouts are enhancements.
- Touch targets MUST be at least 44×44 CSS px; core flows (search, mark a game, change its state)
  MUST work without hover.
- UI MUST meet WCAG 2.2 AA: semantic HTML, keyboard operable, labelled controls, sufficient
  contrast, and state never conveyed by color alone.
- No horizontal page scrolling at phone width.

Rationale: if it is awkward on a phone at the fair, the app has failed its main purpose.

### II. Test-First (NON-NEGOTIABLE)

- Tests MUST be written before the implementation they cover and MUST fail before the code
  is written (red → green → refactor).
- All domain logic (collections, game states, list/search result handling) MUST have unit tests.
- Integration with BoardGameGeek MUST be tested against recorded/fixture responses, not the live
  site.
- A change is not done while any test fails.

Rationale: tests are the spec in executable form and keep a small hobby codebase safe to change.

### III. Domain Logic Separate from UI

- Domain logic (games, collections, states such as "Interested", "Must Have", "Poop") MUST live in
  a UI-independent module with no imports from the UI framework or browser APIs.
- Access to BoardGameGeek and to storage MUST go through narrow interfaces so they can be
  replaced by fakes in tests.
- The UI MUST only render state and forward user intents to the domain layer.

Rationale: keeps logic unit-testable (Principle II) and lets the UI change without touching rules.

### IV. Simplicity (YAGNI)

- Build the smallest thing that serves a real, current need of the users; no speculative
  features, settings or abstractions.
- New dependencies, services or infrastructure MUST be justified in the plan with the simpler
  alternative that was rejected.
- The set of game states MUST be easy to extend, but only states actually needed are added.

Rationale: a small group of friends uses this for a concrete event; complexity costs more than it
earns.

### V. Respectful BoardGameGeek Integration

- BoardGameGeek is the source of truth for game data; the app stores only BGG IDs, the user's own
  data (collection membership, states) and minimal cached display data.
- Requests to BGG MUST follow its API terms of use, be rate-limited, and cache responses so
  repeated views do not re-fetch.
- BGG being slow or unavailable MUST NOT make the user's collection unreadable; failures MUST be
  shown with a clear, recoverable message.

Rationale: the app depends on a third-party site it does not control and must not abuse it.

## Product & Technical Constraints

- Platform: responsive web app, usable in current mobile Safari and Chrome; no app-store release.
- Audience: the author and a small group of friends; no public sign-up, no monetization.
- Data: the user's collection and states MUST survive page reloads and MUST NOT be lost when
  a BGG request fails.
- Secrets (API tokens, credentials) MUST NOT be committed to the repository.
- Concrete stack choices are made per feature in `/speckit-plan` and MUST comply with this
  constitution.

## Development Workflow

- Features follow the Spec Kit flow: specify → (clarify) → plan → tasks → implement.
- Each plan MUST include a Constitution Check against Principles I–V; any violation MUST be
  listed with its justification in the plan's complexity tracking.
- Before a feature is considered done: all tests pass and core flows have been checked at
  phone width.
- Work happens on feature branches; `main` stays working.

## Governance

- This constitution supersedes other practices in this repository; where they conflict, it wins.
- Amendments are made via `/speckit-constitution`, recorded with a version bump and an updated
  Last Amended date.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR for
  adding a principle or materially expanding guidance, PATCH for clarifications and wording.
- Every plan and review MUST verify compliance; unjustified complexity is grounds to reject a
  change.

**Version**: 1.0.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16
