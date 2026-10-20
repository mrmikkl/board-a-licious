# Contract: `GET /api/bgg/images` and the image viewer

## API

`GET /api/bgg/images?id=<bggId>` (signed-in person, as the other `/api/bgg` routes)

**200**

```json
{
  "bggId": 295947,
  "total": 600,
  "images": [
    { "id": 5100691, "large": "https://cf.geekdo-images.com/…__large/…/pic5100691.jpg", "small": "https://cf.geekdo-images.com/…__small/…/pic5100691.jpg", "caption": "Box front" },
    { "id": 7243634, "large": "…", "small": "…", "caption": null }
  ]
}
```

- `images`: main image first (R2), then BGG's game gallery sorted "hot", no duplicates, ≤ 50.
- A game without gallery images: `images` holds only the main image (or is empty if the game has none).

**Errors** (as the other BGG routes): `400 bad_request` (missing or non-positive id),
`404 not_found` (unknown game), `503 bgg_rate_limited` with `Retry-After`, `502 bgg_unavailable`.

Upstream (server only): `https://api.geekdo.com/api/images?ajax=1&gallery=game&nosession=1&objectid=<id>&objecttype=thing&pageid=1&showcount=50&size=thumb&sort=hot`
plus the cached `api/geekitems` for the main `imageid`; cached 7 days; honest User-Agent; at most one
BGG request per second (existing client).

## Viewer (UI contract for tests)

| Element | Role / name |
|---|---|
| cover button in a details sheet | button "Show the images of <game> big" |
| viewer | dialog "Images of <game>" (modal) |
| close | button "Close" |
| position | text "3 / 24" (live region), only with more than one image |
| image | img, alt "<game>, image 3 of 24" |
| previous / next | buttons "Previous image" / "Next image" (pointer devices; disabled at the ends) |
| note | text when there is a single image: offline, no more images, or details pending |

Keys: ←/→ step, Esc closes. Back (history) closes. Swipe: see research R5.

## Show-off (UI contract for tests)

| Element | Role / name |
|---|---|
| action in a collection's action bar | link/button "Show-off" (outer right) |
| sheet | dialog "Show-off"; one toggle button per group, name "<emoji> <label> <count>", `aria-pressed`; Cancel; "Show off" (disabled with none pressed) |
| screen | `h1` "Show-off", back link "Back" → the collection, line "<collection> · <marks> · <n> games" |
| hexagon | button "<game>, <mark label>" → the viewer |
| empty | heading "No game in these groups", button "Choose groups" → the sheet |
