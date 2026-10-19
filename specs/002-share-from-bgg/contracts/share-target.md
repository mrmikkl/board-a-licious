# Contract: Share target

The interfaces this feature adds. No `/api` changes.

## Web app manifest (`vite.config.ts` → `manifest.webmanifest`)

```json
"share_target": {
  "action": "/share-target",
  "method": "GET",
  "params": { "title": "title", "text": "text", "url": "url" }
}
```

`start_url`, `scope` and `display: "standalone"` stay as in feature 001; `/share-target` is inside
the scope.

## Entry URL

`GET /share-target?title=<t>&text=<x>&url=<u>`: every parameter optional and URL-encoded. Served
with the app shell (service-worker navigation fallback offline, single-page fallback online).

On boot the app rewrites it once, before routing, to:

## In-app route

`#/shared?title=<t>&text=<x>&url=<u>` → `{ name: "shared", title?, text?, url? }`

| Shared content (see [data-model](../data-model.md)) | Screen |
|---|---|
| game | last share collection (else the collections screen) with the **Shared game** sheet |
| list | the list screen of that list (`#/lists/<kind>/<id>`), loading it if new |
| none | last share collection with the **Not a BoardGameGeek game** sheet |

After adding, the app goes to `#/collections/<id>` (history replaced, so Back does not reopen the
sheet). Cancel or Close goes to the screen behind the sheet, also replacing the history entry.

## Config

While `display-mode: standalone` does not match, Config shows the **Share hint** card at the top
(docs/design.md v1.9.0).
