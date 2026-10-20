# Research: Big Game Images, BGG Gallery and Show-off

## R1. Where the gallery comes from

- **Decision**: BoardGameGeek's public image gallery JSON, the same kind of source the app already
  reads for games and lists (`GeekdoSource`, ADR 0005):
  `https://api.geekdo.com/api/images?ajax=1&gallery=game&nosession=1&objectid=<id>&objecttype=thing&pageid=1&showcount=50&size=thumb&sort=hot`.
  One page of 50 (the spec's cap) per game. Each image has `imageid`, `imageurl_lg` (fit-in
  1024×1024, no upscaling: the "large version"), `imageurl` (200×150), `caption`, `href`.
  Recorded fixture: `tests/fixtures/bgg/images-295947.json` (first 8 images of Cascadia, total 600).
- **Rationale**: the official XML API has no image gallery; constitution V's exception allows the
  website's public JSON through the server-side adapter, on demand, cached, with an honest
  User-Agent. `gallery=game` keeps to the game's own photos (box, components, play) instead of
  people and creative galleries; `sort=hot` is BGG's "most relevant first".
- **Alternatives considered**: `gallery=all` (people photos and fan art first; less useful);
  scraping image pages (forbidden by the constitution).
- **Consequences**: no new ADR: it is one more method on the existing `BggSource` adapter. When the
  official API token arrives, the gallery stays on the exception (the API does not offer it) until
  2027-01-31 or until BGG offers an official way; the adapter can then drop it without changes
  elsewhere (the viewer falls back to the cover).

## R2. The main image first, then the gallery

- **Decision**: the server answers `GET /api/bgg/images?id=<bggId>` with `{ bggId, total, images: [{ id,
  large, small, caption }] }`, ordered by a pure domain function `orderGallery(mainImageId, images)`:
  the game's main image (`imageid` from the cached geekitem) first, then the rest in BGG's order,
  without duplicates, at most 50. If the main image is not on the first page, it is added from the
  geekitem (`images.previewthumb` as small, `images.original` is too big, so `imageurl` of the
  geekitem `__itemrep` at 246×300 serves as large).
- **Rationale**: the viewer opens on the image the user tapped (the cover); the spec asks for the
  main image first. Ordering is a rule, so it lives in `src/domain/` with unit tests (constitution III).

## R3. Caching: no second request to BoardGameGeek (SC-005, FR-004)

- **Decision**: the server caches the gallery response with the BGG client cache, TTL as games (7
  days); the app keeps galleries it loaded in memory for the session (a `Map` by `bggId` in the
  client), so reopening the viewer does not even call the server. Not stored in IndexedDB.
- **Rationale**: the server cache already guarantees "no new request to BoardGameGeek" across users
  and devices; an IndexedDB store would need a database version bump for little gain (YAGNI).
  Offline, the viewer shows the cover and says the gallery comes once online (spec Edge Cases).
- **Alternatives considered**: a `galleries` object store (offline galleries after a reload;
  rejected: image files are not available offline anyway unless already in the browser cache).

## R4. Image files

- **Decision**: images load directly from `cf.geekdo-images.com` in `<img>` with
  `referrerPolicy="no-referrer"` and `decoding="async"`, as covers do today; the viewer shows the
  cover (`square200`, already on the phone) at once and swaps in the large version when it has
  loaded; neighbours of the current image (±1) are preloaded, the rest load when swiped to.
- **Rationale**: no proxying of image bytes through the Worker (cost, BGG's CDN is the right place);
  SC-001 (cover instantly, sharp version when it arrives); SC-002 (next image already loaded).

## R5. The viewer's gestures

- **Decision**: a small pure module `src/app/viewer-gesture.ts` (unit-tested like `sheet-drag.ts`)
  decides from pointer moves: axis lock after 8px; horizontal drag follows the finger, with
  resistance ⅓ past the first/last image; release: step when |dx| > 50px or a flick (> 0.5 px/ms),
  else spring back; vertical drag down follows the finger and fades the backdrop; release closes
  when dy > 100px or a flick down. The track moves with `transform` only; a step changes position,
  dots and caption in place (no re-mount: React keys are stable, the viewer component stays mounted).
  Pinch zoom: while two pointers are down, no swipe is handled.
- **Rationale**: matches the agreed prototype (spring back, no flicker); keeps gesture maths testable
  without a browser.

## R6. Back closes the viewer

- **Decision**: opening the viewer pushes a history entry (`history.pushState({ viewer: true }, '')`,
  same hash); `popstate` closes it; ✕, Esc and swipe-down call `history.back()`. The hash router does
  not react (the hash does not change).
- **Rationale**: FR-003 (Back closes) without turning the viewer into a route of its own; it opens
  over a sheet whose state is local.

## R7. Show-off routes and the remembered choice

- **Decision**: the sheet is `#/collections/<id>?show-off` (`open: 'showoff'`, like `?add=`); the
  screen is `#/collections/<id>/show-off/<groups>` with the groups as mark keys joined by commas
  (e.g. `must_have,interested`), so Back from the viewer and from the screen work and the screen can
  be reloaded. The last choice per collection is the meta key `showOff: Record<collectionId, Mark[]>`
  (device only, like `groupBy`), first time `['must_have']`.
- **Rationale**: consistent with feature 003's route-driven sheets; no server change.

## R8. Honeycomb layout

- **Decision**: CSS, not canvas: rows of three `button`s with `clip-path: var(--hex)`, width
  `w = (column − 3·gap) / 3.5`, height `w · 1.1547`, rows overlap by a quarter of the height
  (`margin-top: −0.2887·w + gap`), odd rows shifted right by `(w + gap) / 2`; covers via `<img
  loading="lazy">` filling the hexagon (`object-fit: cover`). The order of games is a domain function
  `showOffGames(entries, groups, nameOf)` (collection group order, by name) in `src/domain/collection.ts`.
- **Rationale**: agreed prototype layout; lazy images keep 100+ games smooth (SC-004); each hexagon is
  a real button for keyboard and screen readers.
