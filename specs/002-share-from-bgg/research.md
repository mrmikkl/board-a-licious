# Research: Share from BGG into the App

## R1. How a web app receives shares on Android

- **Decision**: Web Share Target with `method: "GET"` in the web app manifest:
  `share_target: { action: "/share-target", method: "GET", params: { title: "title", text: "text", url: "url" } }`.
  Sharing opens `/share-target?title=…&text=…&url=…` in the installed app.
- **Rationale**: GET needs no service-worker code (POST is only needed for files); the parameters
  arrive in the URL and the app reads them on start. Chrome on Android lists installed PWAs
  (WebAPKs) with a `share_target` in the share menu.
- **Alternatives considered**: POST share target (needs a service-worker fetch handler; only useful
  for files, which we do not accept); a native wrapper app (out of scope, YAGNI).
- **Consequences**: only installed apps appear in the share menu; a phone that installed the app
  before this feature gets the share entry once Chrome refreshes the WebAPK from the new manifest
  (it checks on launch, at most about once a day); reinstalling makes it immediate. iOS Safari does
  not support share targets: there the feature simply does not exist (spec Assumptions).

## R2. Getting `/share-target` into the hash router, online and offline

- **Decision**: on boot, before routing, `src/app/share-target.ts` checks
  `location.pathname === "/share-target"`, reads the three parameters, and replaces the URL with
  `/#/shared?title=…&text=…&url=…` via `history.replaceState`. It runs once per page load, so a
  reload of the resulting page does not share twice.
- **Rationale**: the app uses hash routes (feature 001). The service worker's navigation fallback
  already answers every non-`/api` navigation with the cached `index.html`, so `/share-target`
  opens offline too; online, Cloudflare's single-page-application fallback serves `index.html`
  (`not_found_handling` in `wrangler.jsonc`).
- **Alternatives considered**: making `share_target.action` a hash URL (`/#/shared`): Chrome
  appends the parameters to the query of the action URL, which with a hash would land in front of
  the hash; workable but fragile. A separate HTML page for the share: duplicates the app shell.

## R3. Expired sign-in and Cloudflare Access

- **Decision**: nothing extra. A share opened online with an expired Access session goes through the
  Access login (Access keeps the original URL with its query and returns to it) or, more often, is
  answered from the service worker's cached shell without reaching Access; the app then works local
  first and shows the existing "Sign in again" banner (feature 001) until the sync can send.
- **Rationale**: FR-009 is already met by 001's outbox and banner.

## R4. Reading the shared text

- **Decision**: a pure function `readShare({ title, text, url })` in `src/domain/shared.ts`:
  1. Look for a BGG link in `url`, then in `text`, then in `title` (first match wins).
  2. A game or expansion link (`/boardgame/<id>`, `/boardgameexpansion/<id>`, 001's `parseGameLink`)
     → `{ kind: "game", bggId, suggestedName }`.
  3. A preview or geeklist link (001's `parseListLink`) → `{ kind: "list", ref }`.
  4. Anything else → `{ kind: "none", shown }` (the first link or the text, for the sheet).
  - **Suggested name**: the shared title with BGG's suffixes removed ("Cascadia | Board Game |
    BoardGameGeek" → "Cascadia"), else the text before the link when it is short plain text, else
    the name from the link's slug (001); the device's known name wins over all of these.
- **Rationale**: Chrome shares the page URL in `url` (sometimes in `text`); apps such as BGG's share
  plain text with the link inside. Covering all three fields covers both sources (SC-002).
- **Alternatives considered**: asking BGG for the name (a request per share; unnecessary because
  001's details completion fills it in later).
- **Open point for implementation**: record real share texts from the BGG Android app and Chrome as
  test fixtures (SC-002 asks for 10 of each); adjust the name rules if they differ.

## R5. Remembering the collection shared into last

- **Decision**: meta key `lastShareCollection` (collection id) in the person's IndexedDB on the
  device; preselect it if it still exists, else the first collection by name.
- **Rationale**: FR-004 asks for "per person on the device"; not synced, so each phone keeps its own
  habit. No server change (Principle IV).

## R6. Telling whether the app is installed (Config hint)

- **Decision**: show the Share hint while `matchMedia("(display-mode: standalone)")` does not match,
  i.e. while the app runs in a browser tab.
- **Rationale**: the share entry exists only for the installed app; opening the installed app from
  its icon runs standalone, so the hint disappears exactly where sharing works. Opening the site in
  a normal tab shows the hint, whose text also says to open the app from its icon.
- **Alternatives considered**: `beforeinstallprompt`/`getInstalledRelatedApps` (unreliable, not on
  all versions).

## R7. No double adds

- **Decision**: the sheet checks the chosen collection's entries (as 001's Add game does) and
  disables adding when the game is in it; the add action itself is idempotent per collection and
  game (entries are keyed by collection and game in 001). Cancelling only closes the sheet.
- **Rationale**: SC-004; a second share of the same game shows "already in it".
