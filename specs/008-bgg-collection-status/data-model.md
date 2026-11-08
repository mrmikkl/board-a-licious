# Data Model: BGG Statuses, Buy and Lists

Where each piece lives: [research.md](research.md) R6. Collections, entries and loaded lists stay as
they are ("shopping list" is only the visible word).

## Status (`src/domain/bgg-status.ts`)

| Field | Type | Rule |
|---|---|---|
| `own`, `prevOwned`, `forTrade`, `wantInTrade`, `wantToBuy`, `wantToPlay`, `preordered` | boolean | BGG's flags `own`, `prevowned`, `fortrade`, `want`, `wanttobuy`, `wanttoplay`, `preordered` |
| `wishlist` | `1 \| 2 \| 3 \| 4 \| 5 \| null` | null = not on the wishlist; BGG's `wishlist` + `wishlistpriority` |

- `StatusKey` = `'own' | 'preordered' | 'wishlist' | 'wantToPlay' | 'forTrade' | 'wantInTrade' | 'wantToBuy' | 'prevOwned'`,
  in this **badge order** (FR-009); labels: Owned, Preordered, Wishlist n, Want to play, For trade,
  Want in trade, Want to buy, Previously owned; wishlist priority names 1 Must have … 5 Don't buy this.
- `badges(status, max?)` → the keys that are set, in badge order, at most `max`, plus the rest count.
- `statusList(collection, key)` → the items with that key set; the Wishlist sorted by priority.
- `diff(before, after)` → only the changed keys (what a save sends, FR-017).

## BggCollection (device, IndexedDB store `bggCollections`, key `bggUser`)

| Field | Type | Rule |
|---|---|---|
| `bggUser` | string | lower-cased BGG username; the person's own or a followed friend's |
| `items` | `BggCollectionItem[]` | one per game (copies merged: a status counts if any copy has it) |
| `loadedAt` | ISO time | re-read when older than 1 hour on open (FR-004) |
| `error` | `'not_found' \| 'private' \| null` | last answer when it failed |

`BggCollectionItem`: `bggId`, `name`, `year`, `thumbnailUrl`, `kind` (`boardgame` \| `expansion`), `status`.

After a successful save the app replaces the item's `status` with the Worker's answer (no re-read).

## UserSetting (synced; table `user_setting`)

| Column | Type | Rule |
|---|---|---|
| `user_email` | text PK | the Access email |
| `bgg_username` | text \| null | 1–50 chars, BGG's username characters; null = none |
| `updated_at`, `synced_at` | timestamptz | last write wins (ADR 0004) |

## FollowedBggUser (synced; table `followed_bgg_user`)

| Column | Type | Rule |
|---|---|---|
| `user_email` | text | PK with `bgg_user` |
| `bgg_user` | text | lower-cased; never the person's own username |
| `updated_at`, `synced_at` | timestamptz | |
| `deleted` | boolean | tombstone (removing a friend's lists) |

Created by pasting a link `boardgamegeek.com/collection/user/<name>[?…status=1…]` into Load a BGG
list (`parseBggCollectionLink` in `src/domain/bgg-link.ts`); the status in the link only chooses
which of the friend's lists opens first.

## BGG account cookie (device, HttpOnly; never in IndexedDB, sync or backups)

Encrypted (AES-GCM, `BGG_SESSION_KEY`) JSON `{ email, bggUser, cookies, expiresAt }`; name
`bal_bgg`, `Path=/api/bgg/account; HttpOnly; Secure; SameSite=Strict; Max-Age ≤ 2592000`.
Rejected (and cleared) when `email` differs from the request's Access email or it expired.

## Device meta (`src/client/store.ts` `MetaValues`)

| Key | Type | Default |
|---|---|---|
| `badgeColours` | `Record<StatusKey, PaletteName>` | Owned cool, Preordered dusk, Wishlist pink, Want to play violet, For trade hot, Want in trade white, Want to buy mint, Previously owned grey |
| `lastTab` | `{ buy: 'search' \| 'shopping'; lists: 'status' \| 'previews' \| 'geeklists' }` | Search; Status lists |
| `bggSignedInAs` | string \| null | a hint for the UI only (the cookie decides); refreshed from `GET /api/bgg/account` |

`PaletteName` = `cool | hot | mint | pink | white | violet | dusk | red | mud | grey`.

## PrivateInfo (sent once, after buying; never stored by the app)

| Field | Source |
|---|---|
| `pricePaid` `{ amount, currency }` | the Buy sheet; omitted when empty |
| `acquisitionDate` | the day of buying (device date, `YYYY-MM-DD`) |
| `acquiredFrom` | "SPIEL Essen 2026 · booth 3-A101" when the entry has a booth from a SPIEL preview, else the chosen offer's shop, else omitted |

## State transitions

- **Sign-in**: none → signed in (cookie set) → expired / rejected by BGG (cookie cleared, `401
  bgg_signed_out`) → none. Sign-out or app sign-out → none.
- **Status save**: draft (sheet) → saving → saved (statuses replaced from the answer) | failed
  (draft kept, retry) | price conflict (ask, then save again with `replacePrice`).
