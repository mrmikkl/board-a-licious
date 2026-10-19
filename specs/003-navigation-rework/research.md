# Research: Navigation Rework with a Context-Aware Main Button

## R1. Who renders the action bar

- **Decision**: each screen renders its own `<ActionBar main={…}>{actions}</ActionBar>` at the end
  of its markup, like it renders its heading today. The shell (`App.tsx`) renders only the app bar,
  the sign-in banner and the screen.
- **Rationale**: the actions need the screen's state (the open collection, its filter, its sheets);
  keeping them in the screen avoids passing callbacks up through a context or a registry. Screens
  without actions (Config, a single list, Swipe, Share and backup, the Shared screen) simply render
  none (FR-011, FR-012).
- **Alternatives considered**: a global action context that screens fill (more moving parts, stale
  actions across navigation); a per-route table in the shell (the shell would need to know every
  screen's state).

## R2. The menu: pattern and accessibility

- **Decision**: a disclosure: the ☰ button has `aria-expanded` and `aria-controls`; the panel is a
  `<nav aria-label="Menu">` with a list of links (`aria-current="page"` on the current place). On
  open, focus moves to the current place's link; Esc, a scrim tap or choosing a place closes it and
  focus returns to ☰ (unless the place changed, then to the new screen's heading). Route changes
  close it.
- **Rationale**: these are navigation links, not commands, so the ARIA `menu` role (arrow-key
  model, `menuitem`) is the wrong fit; a disclosure with links works with Tab and screen readers
  without extra keyboard code (WCAG 2.2 AA, constitution I).
- **Alternatives considered**: `role="menu"` (needs roving focus and arrow keys); a `<dialog>`
  (modal focus trap is heavier than needed for four links).

## R3. Sheets that used to live on the add screen

- **Decision**: open them from routes with a query, so links from anywhere can reach them and Back
  closes them:
  - `#/collections?new` → Collections with the **New collection** sheet open;
  - `#/lists?load` → BGG lists with the **Load a BGG list** sheet open;
  - `#/collections/<id>?add=game` and `?add=list` → the collection with Add game or BG-Tinder open.
  The main buttons navigate to these routes (push), closing a sheet replaces the route without the
  query. Old addresses: `#/add` → `#/collections`, `#/add/collection` → `#/collections?new`,
  `#/add/list` → `#/lists?load`, `#/add/game` → `#/collections` (no collection known).
- **Rationale**: the router already splits off a query since feature 002; links in Share and backup,
  a failed list, the membership sheet, Search and the "Not a BoardGameGeek game" sheet currently
  point at `#/add/…` and need a target that opens the right sheet. Back closing a sheet matches how
  people use Android.
- **Alternatives considered**: local state only (links from other screens could not open the
  sheet); keeping the Add screen as a hidden route (dead UI that the design removes).

## R4. Ticker for long collection names

- **Decision**: a `Ticker` component renders the name in an inner span; a `ResizeObserver` on the
  heading measures `scrollWidth - clientWidth`. When it overflows, the heading gets `is-long` and
  the CSS custom properties `--ticker-shift` and `--ticker-time` (shift / 50px per s / 0.64, at
  least 4 s); a CSS keyframe holds 18%, moves to `-shift`, holds 18%, loops. Soft fades are a
  `mask-image` on the heading. Under `prefers-reduced-motion` the animation is off and the text
  ends in "…" (`text-overflow: ellipsis`). The heading keeps the full name as its text, so screen
  readers read it once; the moving span is `aria-hidden` only if a duplicate is ever needed (it is
  not: one span).
- **Rationale**: transform-only CSS animation runs on the compositor and costs nothing while idle;
  the observer re-measures on rotation, resize and rename. Matches the agreed prototype.
- **Alternatives considered**: JS `requestAnimationFrame` loop (needless work); the `<marquee>`
  element (obsolete); wrapping to two lines (rejected in review).

## R5. Group order and the separator

- **Decision**: `groupByMark` gets the collection order Must Have, Interested, Unsure, Poop, Not yet
  marked, Not interested, and each group carries `part: 'marked' | 'rest'`. The screen draws the
  separator before the first `rest` group when a `marked` group precedes it. Not yet marked and Not
  interested both fold; Not yet marked starts open, Not interested closed (local state, not stored).
  `MARKS` (the order for pickers, filters, counts and share text) stays as it is.
- **Rationale**: the order is a rule of the collection view (constitution III), testable in unit
  tests; the separator is presentation of the `part` boundary. Only one caller uses `groupByMark`.
- **Alternatives considered**: reordering `MARKS` (would change pickers, filters and the share text,
  against FR-017).

## R6. App icons

- **Decision**: a one-off script `scripts/make-icons.mjs` (run with `node`, using the Playwright
  Chromium already installed for tests) builds `public/icons/` from
  `specs/003-navigation-rework/design/icons/Hexagon Icons/hex-gradient-colour.png`:
  `logo.png` (trimmed hexagon, 120px wide, for the app bar), `icon-192.png` and `icon-512.png`
  (`purpose: any`, transparent corners), `icon-maskable-512.png` (the meeple hexagon at 80% on a
  full square in `--ink`, inside Android's safe zone), `apple-touch-icon.png` (180px, `--ink`
  background, iOS ignores transparency) and `favicon.png` (from `Favicons/favicon-color.png`, 48px).
  The PNGs are committed; the manifest lists 192/512/maskable; `index.html` links the favicon and
  the apple-touch-icon; `public/icon.svg` is removed.
- **Rationale**: no new dependency (constitution IV); generated files are reproducible from the
  committed source; Chrome needs 192 and 512 PNGs for the install prompt and the home screen, and a
  maskable icon to avoid a white plate around the hexagon (spec FR-019a).
- **Alternatives considered**: `sharp` or `@vite-pwa/assets-generator` as dev dependencies (more
  weight for a one-time job); keeping the SVG (it is the old "B" mark).

## R7. Layout: heights, toast, safe areas

- **Decision**: the app bar is sticky (`top: 0`, about 48px); the action bar keeps the tab bar's
  fixed dock position, padding and `env(safe-area-inset-bottom)`; `.app` keeps its bottom padding
  only when an action bar is shown (class on the shell from the route); the toast sits above the
  action bar, or 24px above the bottom on screens without one. Sheets (`z-index` 31) cover the
  action bar (20); the menu sits between (scrim 26, panel 27) and below sheets.
- **Rationale**: reuses the measured tab-bar spacing that already works on phones with gesture bars;
  no content hides behind a missing bar on Config (SC-003 room).
- **Alternatives considered**: a non-sticky app bar (the menu would scroll away on long
  collections).

## R8. Existing end-to-end tests

- **Decision**: add small helpers in `tests/e2e/helpers` (`goTo(page, 'BGG lists')` via the menu,
  `mainButton(page)`), then move the 13 affected specs from the tab bar, the `#/add` screen, "Add by
  list", "Collection options" and the collection's back button to the new controls, one user story
  at a time, keeping their assertions about behaviour.
- **Rationale**: the behaviour of 001/002 must keep working (SC-005); helpers keep the change in one
  place if the menu changes again.
