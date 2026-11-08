# Tasks: BGG Statuses, Buy and Lists

**Input**: Design documents from `/specs/008-bgg-collection-status/`
**Prerequisites**: plan.md, spec.md (US0–US5), design.md, research.md (R1–R9), data-model.md,
contracts/api.md, contracts/ui.md, quickstart.md; design rules `docs/design.md` v3.0.0; ADRs 0001–0009;
constitution 1.4.0; the code of features 001–007.

**Tests**: Required. Constitution II (test-first, NON-NEGOTIABLE): every test task comes before the
code it covers and must fail first. No live BGG in tests: XML answers in `tests/fixtures/bgg-xml/`,
website traffic in `tests/fixtures/bgg-web/` (recorded in T001, cookies, usernames and passwords
removed); e2e tests fake `/api/bgg/*` in `tests/e2e/helpers.ts`.

**Organization**: US0 places and tabs (P1), US1 status lists (P1), US2 badges (P1), US3 sign-in (P2),
US4 change statuses (P2), US5 buying updates BGG (P2). US1 and US2 share the collection loader of
Phase 2; US4 needs US3; US5 needs US4's write route.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: user story the task belongs to (US0–US5)

---

## Phase 1: Setup

- [x] T001 Spike with the owner (research R2, R3): with the browser's developer tools open on boardgamegeek.com, record (a) the sign-in request and its answer (cookie names, lifetime), (b) a wrong-password answer, (c) ticking Own and Wishlist priority 2 on a test game, (d) entering price paid 45 EUR, acquisition date and "acquired from", (e) opening the edit dialog of an owned game (the item read with `collid`, statuses and price paid), (f) adding a game that is not yet in the collection; save each request and answer as files in `tests/fixtures/bgg-web/` (`signin-ok.json`, `signin-wrong.json`, `item-owned.*`, `item-none.*`, `save-status.*`, `save-private.*`, `save-new.*`) with every cookie value, password and username replaced by placeholders; write the endpoints, fields and answers found into `specs/008-bgg-collection-status/research.md` R2/R3 (replacing "verify in T001"); also record `xmlapi2/collection` for a nonexistent user and a private collection — done 2026-11-08 from one recording: (b) wrong password and the status editdata answer were not captured; the adapter reads statuses and collid through the official API instead and treats any non-204 sign-in as refused (research R2/R3); fixtures under the names in `tests/fixtures/bgg-web/`
- [X] T002 [P] Record `tests/fixtures/bgg-xml/collection-games.xml` and `collection-expansions.xml` (a small public collection: an owned game, an owned expansion, wishlist priorities 1 and 3, want to play, for trade, preordered, previously owned, a game listed twice) and `collection-queued.xml` (the 202 body), `collection-unknown-user.xml` with a one-off `scripts/record-collection.mjs` (honest User-Agent, token from `.dev.vars`, never printed) — 2026-11-08: recorded mrmikkl's collection (838 games, 337 expansions) and trimmed to 17 + 10 items; it has no Want to buy and no Preordered item and no game listed twice in the expansions, so tests add those by hand; `collection-queued.xml` is BGG's 202 message, `collection-unknown-user.xml` its `<errors>` answer
- [X] T003 [P] Add `BGG_SESSION_KEY` to `.dev.vars.example` (comment: 32 bytes base64, `npx wrangler secret put BGG_SESSION_KEY` in production) and to `Env` in `worker/index.ts`; add e2e helpers to `tests/e2e/helpers.ts`: `fakeBggCollection(page, user, items, { preparingFor? })`, `fakeBggAccount(page, { signedIn, bggUser, saveResult?, priceConflict? })` recording the save bodies, and update `Place`/`goTo` to `'Buy' | 'Lists' | 'Config'` with a `tab` argument

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 [P] Write failing unit tests in `tests/unit/bgg-status.test.ts` for `src/domain/bgg-status.ts` (data-model "Status"): `StatusKey` badge order own, preordered, wishlist, wantToPlay, forTrade, wantInTrade, wantToBuy, prevOwned; `label(key, status)` ("Owned", "Wishlist 2", …); `PRIORITY_NAMES` 1 Must have, 2 Love to have, 3 Like to have, 4 Thinking about it, 5 Don't buy this; `badges(status, max)` → `{ shown, rest }`; `statusList(items, key)` (Wishlist sorted by priority, then name); `diff(before, after)` returns only changed keys; `mergeCopies(items)` (a status counts if any copy has it); `fromBggFlags({ own, prevowned, fortrade, want, wanttoplay, wanttobuy, wishlist, wishlistpriority, preordered })`
- [X] T005 Implement `src/domain/bgg-status.ts` (T004)
- [X] T006 [P] Write failing worker tests in `tests/worker/bgg-collection.test.ts`: `OfficialSource.getCollection(user)` asks `collection?username=<u>&subtype=boardgame&excludesubtype=boardgameexpansion` and `…&subtype=boardgameexpansion` with the token, maps items (kind from the request, copies merged), caches 15 minutes; 202 after the client's retries → `BggError('bgg_preparing', …, retryAfter)`; `<errors>` invalid username → `not_found`; and in `tests/worker/bgg-cache.test.ts` that the `Authorization` header goes only to `/xmlapi` and `/xmlapi2` URLs (research R5)
- [X] T007 Implement `getCollection` in `worker/bgg/official.ts` and `worker/bgg/source.ts` (`BggSource.getCollection`, `GeekdoSource` throws `bgg_unavailable`), route it in `worker/bgg/routing.ts` (official only), add code `bgg_preparing` to `BggError` and the token-path rule in `worker/bgg/cache.ts`
- [X] T008 [P] Write failing worker tests in `tests/worker/collection-route.test.ts` for `GET /api/bgg/collection?user=` (contracts/api.md): 400 for a missing or invalid user ("1–50 chars"), 200 shape, `202 bgg_preparing` with `Retry-After`, 404, `fresh=1` skips the cache
- [X] T009 Implement `worker/routes/collection.ts` and wire it in `worker/index.ts`
- [X] T010 [P] Write failing tests for the synced username and follows: migration `migrations/0007_bgg_user.sql` (tables `user_setting(user_email PK, bgg_username text NULL CHECK length 1–50, updated_at, synced_at)` and `followed_bgg_user(user_email, bgg_user, updated_at, deleted, synced_at, PK(user_email, bgg_user))`, synced_at indexes) in `tests/worker/db.test.ts`; `GET/POST /api/sync` with `settings` and `follows` (validation, last write wins, tombstones, older clients without the arrays) in `tests/worker/sync.test.ts`; client merge in `tests/unit/sync-client.test.ts` and `tests/unit/store.test.ts` (outbox kinds `setting`, `follow`; store `bggCollections` keyed by `bggUser`; meta `badgeColours`, `lastTab`, `bggSignedInAs` with the defaults of data-model.md)
- [X] T011 Implement `migrations/0007_bgg_user.sql`, `worker/db/repository.ts` (read/write both tables in `listChanges`/`applyChanges`), `worker/routes/sync.ts`, `src/client/store.ts` (DB version bump, store `bggCollections`, meta keys, outbox kinds) and `src/client/sync.ts`
- [X] T012 [P] Write failing unit tests in `tests/unit/bgg-collection-hook.test.ts` for the pure loader state in `src/app/hooks/bgg-collection-state.ts`: fresh when `loadedAt` < 1 hour (FR-004), retry pauses 5, 10, 20, 20 s and give up after ~60 s on `bgg_preparing` (FR-005), offline keeps the stored copy with its time (FR-006)
- [X] T013 Implement `src/client/api.ts` `bggCollection(user, fresh)`, `src/app/hooks/bgg-collection-state.ts` and `src/app/hooks/useBggCollection.ts` (loads into `bggCollections`, exposes `statusOf(bggId)` for the person's own username)

**Checkpoint**: `npm test` green; nothing visible changed.

---

## Phase 3: User Story 0 - Two places: Buy and Lists (Priority: P1) 🎯 MVP

**Goal**: menu Buy · Lists · Config; Buy tabs Search | Shopping lists; Lists tabs Status lists | Previews | Geeklists; one game sheet; "shopping list" wording; old addresses work.

**Independent Test**: menu shows Buy, Lists, Config; Buy › Shopping lists shows "Essen 2026"; Lists › Previews the SPIEL preview; `#/collections` and `#/search` land on Buy.

### Tests for User Story 0

- [x] T014 [P] [US0] Write failing unit tests in `tests/unit/router.test.ts` for every row of contracts/ui.md "Routes" (new addresses and old-address mapping, e.g. `#/collections/<id>/swipe/preview/1` → `#/buy/lists/<id>/swipe/preview/1`, `#/buy/295947` → `#/buy?game=295947`) and in `tests/unit/membership.test.ts` for `inText(lists, here?)` ("in X", "in X and Y", "in 3 shopping lists", "also in …", empty)
- [x] T015 [P] [US0] Write failing Playwright tests in `tests/e2e/places.spec.ts`: menu entries Buy, Lists, Config with the current one marked; Buy tablist (Search, Shopping lists) and Lists tablist (Status lists, Previews, Geeklists) with `aria-selected`, last tab remembered after reload; Shopping lists shows seeded collections, the main button "Create a shopping list"; a shopping list has the ‹ back to Shopping lists; a search result is a list game row with "Add <game> to shopping lists" inside the row and opens the game sheet (name, year · publisher, Open on BoardGameGeek, info box, Prices folded, Add to shopping lists, Bought it); in a shopping list the game sheet has Category, Prices folded and Copy/Move/Remove, and no hexagon picker; old addresses; axe at 360 px; update existing specs that use `goTo('Collections' | 'BGG lists' | 'Search')`, "collection" texts or the price screen (`navigation`, `us1-collections`, `us2-lists`, `search`, `buy`, `game-info`, `categories`, `add-sheets`, `prices-section`, …)

### Implementation for User Story 0

- [x] T016 [US0] Implement routes and mapping in `src/app/router.ts` and `inText` in `src/domain/membership.ts` (T014)
- [x] T017 [P] [US0] Create `src/app/components/PlaceTabs.tsx` (ARIA tablist, hot underline, design.md "Place tabs") with styles in `src/app/theme/tabs.css`; store the last tab in meta `lastTab`
- [x] T018 [US0] Change `src/app/components/Menu.tsx` to Buy, Lists, Config; rebuild `src/app/screens/Buy.tsx` with the tabs Search (search field, list game rows, no action bar) and Shopping lists (the content of `screens/Collections.tsx`, main button New shopping list); route `#/buy/lists/<id>` to `screens/Collection.tsx` with a back button; `src/app/screens/Lists.tsx` with the tabs Status lists (empty for now), Previews and Geeklists (loaded lists by kind) and the main button Load a BGG list on every tab; wire in `src/app/App.tsx`
- [x] T019 [P] [US0] Create `src/app/components/ListGameRow.tsx` (design.md "List game row": open button, year, Expansion, teal `inText`, Add row action inside the row) and use it in Buy › Search and `src/app/screens/List.tsx`
- [x] T020 [US0] Rebuild `src/app/components/GameSheet.tsx` as the one game sheet (design.md "Game sheet"; `context: 'shopping' | 'browse'`): head (cover, year · publisher, slot for badges, `inText` button opening the shopping list choice), Open on BoardGameGeek below the cover, info box, `CategorySection` (shopping only), slot for the BGG status section, `PricesSection`, actions per context, description; create `src/app/components/CategorySection.tsx` (folded; the list of `CategorySheet`; a tap sets the category, folds, toasts); open it from Buy › Search, previews, geeklists and shopping lists, replacing `GameInfoSheet` and the list sheet
- [x] T021 [US0] Remove `src/app/screens/Search.tsx`, `src/app/screens/Prices.tsx`, `src/app/components/GameInfoSheet.tsx`, the + of `SearchResultRow.tsx` (keep its compact form for Add game) and the hexagon `CategoryPicker` from the sheet; delete or move their tests
- [x] T022 [US0] Replace every visible "collection" with "shopping list" in `src/app/**` (New shopping list, Create shopping list, Add to shopping lists, Remove from <list>, toasts, empty states, share texts' headings stay as they are) and update affected unit and e2e expectations

**Checkpoint**: US0 works on its own; deployable.

---

## Phase 4: User Story 1 - My BGG statuses as status lists (Priority: P1)

**Goal**: username in Config; Lists › Status lists shows the person's statuses with counts and friends' lists by link; a status list works like any BGG list.

**Independent Test**: Config username "mrmikkl"; Status lists show Owned, Wishlist … with counts; Wishlist grouped by priority; swipe it into a new shopping list.

### Tests for User Story 1

- [X] T023 [P] [US1] Write failing unit tests in `tests/unit/bgg-link.test.ts` for `parseBggCollectionLink(text)`: `https://boardgamegeek.com/collection/user/<name>?…&wishlist=1&…` → `{ bggUser, status: 'wishlist' }` for each status parameter (own, wishlist, wanttoplay, trade → forTrade, want → wantInTrade, wanttobuy, preordered, prevowned), no status → `{ bggUser }`, names URL-decoded and lower-cased, other hosts or paths → null
- [x] T024 [P] [US1] Write failing Playwright tests in `tests/e2e/status-lists.spec.ts` with `fakeBggCollection`: no username → empty state with "Add username in Config"; Config "Your BGG username" + Save username; Status lists "Mine · mrmikkl on BoardGameGeek · loaded …", one card per non-empty status named "<status>, <n> games", none for empty ones; a status list shows list game rows, the Wishlist grouped "1 Must have" …; preparing for 12 s shows "BoardGameGeek is preparing your collection…" then the list by itself; unknown user → "No BoardGameGeek user called “…”" with a link to Config; Refresh reads again with `fresh=1`; loading a friend's collection link via the plus adds "<friend> · loaded by link · read-only" cards; BG-Tinder's list choice offers status lists; offline shows the stored copy with its time; axe

### Implementation for User Story 1

- [x] T025 [US1] (`parseBggCollectionLink` itself is done with T023) Accept the link in `src/app/components/LoadListSheet.tsx` (writes a `follow` row; never the person's own username)
- [x] T026 [US1] Add the BoardGameGeek section to `src/app/screens/Config.tsx` (username field, hint, Save username → `setting` row; changing it clears the BGG sign-in hint)
- [x] T027 [P] [US1] Create `src/app/components/StatusListCard.tsx` (design.md "Status list card") and fill Lists › Status lists in `src/app/screens/Lists.tsx` (own group, friends' groups, empty state, error lines)
- [x] T028 [US1] Create `src/app/screens/StatusList.tsx` (`#/lists/status/<bggUser>/<status>`: heading, resync icon "Read again from BGG", source line, list game rows, Wishlist priority groups, preparing and failure states) and offer status lists in `src/app/components/ListPicker.tsx` (BG-Tinder) so swiping works as for geeklists (`src/domain/swipe.ts` needs a list source for status lists)

**Checkpoint**: US1 works with US0; deployable.

---

## Phase 5: User Story 2 - See a game's statuses everywhere (Priority: P1)

**Goal**: badges in every row, card and sheet; colours from Config; BGG status filter.

**Independent Test**: with "mrmikkl" set, a shopping list row of an owned game shows "Owned"; the swipe card too; Filter › BGG status › Owned narrows the list.

### Tests for User Story 2

- [X] T029 [P] [US2] Write failing unit tests in `tests/unit/filter.test.ts` for the new filter field `bgg: 'all' | 'own' | 'notOwn' | 'wishlist'` in `src/domain/filter.ts` (default all, counts as non-default, games without a known status count as not owned)
- [x] T030 [P] [US2] Write failing Playwright tests in `tests/e2e/badges.spec.ts`: badges in game rows (≤ 2 + "+n"), list game rows, the swipe card and the game sheet (all), one accessible name "On BoardGameGeek: …" per game; no badges without username; a friend's list creates none; Config › Badge colours: rows per status, Change opens "Colour of “Owned”" with ten swatches, a pick applies at once, Reset colours (disabled at default); Filter › BGG status; axe and contrast at 360 px

### Implementation for User Story 2

- [x] T031 [US2] (the `bgg` filter in `src/domain/filter.ts` is done with T029) Add its segment in `src/app/components/FilterPanel.tsx` (after Price)
- [x] T032 [P] [US2] Create `src/app/components/BggBadges.tsx` and `src/app/theme/badges.css` (design.md "BGG status badge", palette with the text colours of "Badge colours"; reads meta `badgeColours`)
- [x] T033 [US2] Show `BggBadges` in `src/app/components/GameRow.tsx` (after price · booth), `ListGameRow.tsx`, `SwipeCard.tsx` (under publisher · year) and the head of `GameSheet.tsx` ("Not in your BGG collection" when a username is set and the game has none)
- [x] T034 [US2] Add Badge colours to `src/app/screens/Config.tsx` with `src/app/components/ColourSheet.tsx` (design.md "Badge colours")

**Checkpoint**: P1 complete (US0–US2): reading only; deployable without the session key.

---

## Phase 6: User Story 3 - Sign in to BoardGameGeek on this device (Priority: P2)

**Goal**: sign in once per device; the BGG session lives only in the encrypted HttpOnly cookie.

**Independent Test**: sign in in Config; reload: still signed in; second browser profile: not; sign out: gone.

### Tests for User Story 3

- [X] T035 [P] [US3] Write failing worker tests in `tests/worker/bgg-session.test.ts` for `worker/bgg/session.ts`: `seal({ email, bggUser, cookies, expiresAt }, key)` / `open(value, key, email, now)` with AES-GCM (random IV; tampered, wrong key, other email or expired → null); `setCookie(value, maxAge)` gives `bal_bgg=…; Path=/api/bgg/account; HttpOnly; Secure; SameSite=Strict; Max-Age=…` with Max-Age ≤ 2592000; `clearCookie()` Max-Age=0
- [ ] T036 [P] [US3] Write failing worker tests in `tests/worker/bgg-account.test.ts` (sign-in part) against the T001 fixtures: `POST /api/bgg/account/signin` forwards the credentials once to BGG's login (no `Authorization` header), answers 200 with the sealed cookie and `{ signedIn, bggUser }`, 401 `bgg_signed_out` "BoardGameGeek did not accept this username or password." without a cookie, 502 when BGG is unreachable; `GET /api/bgg/account` reads only the cookie; `POST …/signout` clears it; a cookie sealed for another email → `{ signedIn: false }` and cleared; no log line and no error message contains the password, a cookie value or the `Cookie` header (capture `console.*`)
- [ ] T037 [P] [US3] Write failing Playwright tests in `tests/e2e/bgg-signin.spec.ts` with `fakeBggAccount`: Config "Change statuses on BGG" text and Sign in to BoardGameGeek; the sign-in sheet (hint, fields, error, Cancel / Sign in); signed-in line "Signed in to BoardGameGeek as mrmikkl on this device" and Sign out of BoardGameGeek; nothing about the session in `localStorage` or IndexedDB after sign-in; axe

### Implementation for User Story 3

- [X] T038 [US3] Implement `worker/bgg/session.ts` (Web Crypto AES-GCM with `BGG_SESSION_KEY`)
- [ ] T039 [US3] Implement the sign-in part of `worker/bgg/account.ts` (endpoints and cookie names from T001; shares the BGG throttle slot; no cache; no token) and `worker/routes/account.ts` for `GET /api/bgg/account`, `POST …/signin`, `POST …/signout`; wire in `worker/index.ts` without logging bodies or cookies
- [ ] T040 [US3] Add `account`, `signIn`, `signOut` to `src/client/api.ts`; create `src/app/components/SignInSheet.tsx`; add the sign-in card to `src/app/screens/Config.tsx`; keep meta `bggSignedInAs` as a hint refreshed from `GET /api/bgg/account`; call sign-out before the app's own sign-out in `src/app/context.tsx`

**Checkpoint**: US3 works; nothing is written to BGG yet.

---

## Phase 7: User Story 4 - Change a game's statuses and write them to BoardGameGeek (Priority: P2)

**Goal**: the folded BGG status section saves only changed statuses to BGG.

**Independent Test**: signed in, tick Want to play on a game, Save on BoardGameGeek: badge and status list update, the website shows it.

### Tests for User Story 4

- [ ] T041 [P] [US4] Write failing worker tests in `tests/worker/bgg-account.test.ts` (save part) against the T001 fixtures: `POST /api/bgg/account/collection/<bggId>` reads the item, merges only the sent keys (a status set on the website meanwhile survives), saves, answers the item's statuses; adds a game not in the collection; never sends a delete; 400 for unknown keys, priority outside 1–5; 401 `bgg_signed_out` without or with a rejected session (cookie cleared); 502 `bgg_refused` on a BGG error; one read and one write per call through the throttle; nothing cached; the app token never sent
- [ ] T042 [P] [US4] Write failing Playwright tests in `tests/e2e/bgg-status.spec.ts`: the folded "BGG status" button with badges in its header (`aria-expanded`); switches named by status, Wishlist shows "Wishlist priority" 1–5 (default 3 Like to have); changed lines "· changed"; Save on BoardGameGeek disabled until a change; the request body holds only the changed keys; success toast "Saved on BoardGameGeek" and badges update without reload; refused → red line with Try again, choices kept; not signed in → "Sign in to save on BoardGameGeek" opens the sign-in sheet and returns to the section with the draft; offline → switches disabled with "Changing statuses needs a connection."; axe

### Implementation for User Story 4

- [ ] T043 [US4] Implement the item read and status save in `worker/bgg/account.ts` and the route `POST /api/bgg/account/collection/<bggId>` in `worker/routes/account.ts` (status part)
- [ ] T044 [US4] Add `saveStatus(bggId, body)` to `src/client/api.ts`; create `src/app/components/BggStatusSection.tsx` (design.md "BGG status section") and place it in `GameSheet.tsx` between Category and Prices; after a save, replace the item's status in `bggCollections` so badges and status lists update

**Checkpoint**: US4 works.

---

## Phase 8: User Story 5 - Buying updates BoardGameGeek (Priority: P2)

**Goal**: after Got it, "Also mark as owned on BoardGameGeek?" writes Own and the private info; an existing price is only replaced after asking.

**Independent Test**: signed in, Buy a game not owned for 45 €, Got it, Mark as owned: it shows Owned; BGG shows price paid, date and acquired from.

### Tests for User Story 5

- [X] T045 [P] [US5] Write failing unit tests in `tests/unit/bgg-status.test.ts` for `privateInfoFor(entry, offer?, today)` in `src/domain/bgg-status.ts` (data-model "PrivateInfo": price omitted when empty; date `YYYY-MM-DD`; acquiredFrom "SPIEL Essen 2026 · booth 3-A101" when the entry has a booth from a SPIEL preview, else the offer's shop, else omitted; ≤ 100 chars) and `askAfterBought(status, pricePaid)` (not owned → mark as owned; owned with a price → add price; owned without → nothing)
- [ ] T046 [P] [US5] Extend `tests/worker/bgg-account.test.ts`: `privateInfo` saved with the T001 private-info fields; existing other price and `replacePrice` missing → `409 price_conflict { current }` and nothing written; `replacePrice: false` writes Own but keeps BGG's private info; `replacePrice: true` replaces; 400 for price ≤ 0 or > 10000, a bad date, acquiredFrom > 100 chars
- [ ] T047 [P] [US5] Write failing Playwright tests in `tests/e2e/buy-owned.spec.ts`: after Got it in a shopping list on a game not owned, the sheet "Also mark as owned on BoardGameGeek?" lists Status Owned, Price paid, Acquisition date, Acquired from; Not now writes nothing; Mark as owned (signed out: sign-in first, then saving) → toast "Saved on BoardGameGeek: <game> owned, price paid added" and the Owned badge; owned game with a price → "Add the price paid on BoardGameGeek?"; conflict → "Replace the price paid on BoardGameGeek?" with Keep <old> / Replace; Bought it from Buy › Search's game sheet (no shopping list) asks the price and then the same question, and creates no shopping list; axe

### Implementation for User Story 5

- [ ] T048 [US5] (`privateInfoFor` and `askAfterBought` are done with T045) Implement the private info save and conflict in `worker/bgg/account.ts` / `worker/routes/account.ts` (T046)
- [ ] T049 [US5] Create `src/app/components/MarkOwnedSheet.tsx` (design.md "Mark as owned sheet", including the replace step) and open it from `src/app/components/BuySheet.tsx` after Got it, both in shopping lists and from the browse game sheet's "Bought it" (a Buy sheet without an entry: price only, nothing stored in the app)

**Checkpoint**: all stories work.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T050 [P] Update `CLAUDE.md` (code layout: `worker/bgg/account.ts`, `session.ts`, `src/domain/bgg-status.ts`; the places Buy/Lists/Config; ADR 0009 rule: website writes only in `account.ts`, session only in the HttpOnly cookie, never logged; `BGG_SESSION_KEY` secret) and `docs/hosting/setup.md` (new secret, migration 0007)
- [ ] T051 Security check of SC-004 with `/security-review` on the branch: passwords and sessions absent from database, logs, backups (`src/domain/backup.ts`), shared texts, IndexedDB and other devices; record the result here
- [ ] T052 Run `npm test`, `npm run build` and `npm run test:e2e`; record the results here (compare flakes with `main`, see memory "E2E on own port")
- [ ] T053 Apply migration 0007 (`npm run db:migrate:neon`), set `BGG_SESSION_KEY` (`npx wrangler secret put BGG_SESSION_KEY`), deploy (`npm run deploy`) and walk through `specs/008-bgg-collection-status/quickstart.md` with the user on the phone

---

## Dependencies & Execution Order

- **Setup** → **Foundational** → US0 → US1 and US2 (both need US0's places and the Phase 2 loader) → US3 → US4 → US5 → Polish.
- T001 (owner, real BGG traffic) blocks T036, T039, T041, T043, T046, T048 only; everything up to US2 can be built meanwhile.
- T005 before T013, T031, T033, T045; T007 before T009; T011 before T025, T026; T016 before T018–T020; T020 before T033, T044, T049; T038 before T039; T043 before T048.
- Same-file order: `GameSheet.tsx` T020 → T033 → T044; `Config.tsx` T026 → T034 → T040; `Lists.tsx` T018 → T027; `worker/bgg/account.ts` T039 → T043 → T048; `worker/index.ts` T003 → T009 → T039; `tests/worker/bgg-account.test.ts` T036 → T041 → T046.

## Parallel Opportunities

- Phase 1: T002 and T003 alongside T001.
- Phase 2: T004, T006, T008, T010, T012 together; then T005, T007 → T009, T011, T013.
- US0: T014 and T015 together; T017 and T019 alongside T016.
- US1/US2: T023, T024, T029, T030 together; T027 and T032 in parallel.
- US3: T035, T036, T037 together.

## Implementation Strategy

1. **MVP**: Phases 1–3 (US0) → test → deploy: the new places with the one game sheet.
2. **Reading** (US1, US2) → deploy: status lists, badges, colours, filter (no secret needed).
3. **Writing** (US3, US4, US5) after T001 → deploy with `BGG_SESSION_KEY`.
4. **Later, not in this feature**: selling (For trade, no longer owned) through the same adapter (ADR 0009).

Suggested Orca Swarm split (docs/orca-swarm.md), after Phase 2 on the branch: A = places and
reading UI (US0, then US1/US2 UI: T014–T034), B = server for writing (T035, T036, T038, T039, T041,
T043, T046, T048 once T001 exists). Merge order A → B, then C = writing UI (T037, T040, T042, T044,
T045, T047, T049).
