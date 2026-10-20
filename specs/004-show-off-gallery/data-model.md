# Data Model: Big Game Images, BGG Gallery and Show-off

No new table, no migration, no new synced data.

## Game image (API and domain, `src/domain/gallery.ts`)

| Field | Type | Notes |
|---|---|---|
| `id` | number | BGG image id |
| `large` | string (URL) | for the viewer, at most 1024×1024 (BGG `imageurl_lg`) |
| `small` | string (URL) | 200×150 (BGG `imageurl`), placeholder while `large` loads |
| `caption` | string \| null | BGG caption, trimmed to 120 chars |

## Game gallery

| Field | Type | Notes |
|---|---|---|
| `bggId` | number | the game |
| `total` | number | how many images BGG has in the game gallery (may exceed `images.length`) |
| `images` | GameImage[] | main image first, then BGG's "hot" order, no duplicates, **at most 50** |

`orderGallery(mainImageId, images, fallbackMain?) → GameImage[]` (pure): moves the image with
`mainImageId` to the front; if it is missing, puts `fallbackMain` first; drops duplicate ids; caps at 50.

Kept: on the server in the BGG cache (TTL 7 days, as game details); in the app in memory for the
session (by `bggId`). Not in IndexedDB.

## Show-off choice (device, IndexedDB meta)

| Key | Value | Notes |
|---|---|---|
| `showOff` | `Record<collectionId, Mark[]>` | last chosen groups per collection; missing → `['must_have']`; unknown marks ignored |

## Show-off games (domain, `src/domain/collection.ts`)

`showOffGames(entries, groups, nameOf) → Entry[]` (pure): live entries whose mark is in `groups`,
in the collection group order (must_have, interested, unsure, poop, new, skip), by name within a mark.

## Routes (in memory, `src/app/router.ts`)

| Route | Hash |
|---|---|
| `{ name: 'collection', id, open: 'showoff' }` | `#/collections/<id>?show-off` (the Show-off sheet) |
| `{ name: 'showoff', id, groups: Mark[] }` | `#/collections/<id>/show-off/must_have,interested` (the screen; unknown marks dropped, none → back to the collection) |

## Viewer state (in memory)

Open game, current index, history entry pushed (R6); nothing stored.
