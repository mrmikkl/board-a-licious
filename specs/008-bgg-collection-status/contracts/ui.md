# Contract: UI

Screens and components as in [design.md](../design.md) and [docs/design.md](../../../docs/design.md)
v3.0.0; this file fixes routes and accessible names that tests rely on.

## Routes (`src/app/router.ts`)

| Address | Route | Note |
|---|---|---|
| `#/buy` | Buy, tab Search | |
| `#/buy?game=<bggId>` | Buy › Search with the game sheet open | old `#/buy/<bggId>` (price screen) maps here |
| `#/buy/lists` | Buy, tab Shopping lists (`?new` opens New shopping list) | old `#/collections` maps here |
| `#/buy/lists/<id>` (+ `/swipe/…`, `/show-off/…`, `?add=`) | a shopping list and its sub-screens | old `#/collections/<id>…` maps here |
| `#/lists` | Lists on the last used tab | |
| `#/lists/status`, `#/lists/previews`, `#/lists/geeklists` (`?load` opens Load a BGG list) | Lists tabs | |
| `#/lists/status/<bggUser>/<status>` | a status list (`status` ∈ own, preordered, wishlist, wanttoplay, fortrade, want, wanttobuy, prevowned) | |
| `#/lists/preview/<id>`, `#/lists/geeklist/<id>` | a preview or geeklist | unchanged |
| `#/search` | → `#/buy` | removed place |
| `#/config` | Config | |

## Accessible names and roles

- Menu entries: "Buy", "Lists", "Config".
- Place tabs: `role="tablist"` named "Buy" / "Lists"; tabs "Search", "Shopping lists", "Status lists",
  "Previews", "Geeklists" (`aria-selected`).
- List game row: button "<game>, <year>[, expansion]"; Add: "Add <game> to shopping lists".
- Badges: one element named "On BoardGameGeek: Owned, Wishlist 2" (the pills `aria-hidden`).
- Status list card: button "<status>, <n> games".
- Game sheet sections: buttons "Category", "BGG status", "Prices" with `aria-expanded`; the status
  switches are checkboxes named by status ("Owned", …); priority: group "Wishlist priority".
- Actions: "Save on BoardGameGeek", "Sign in to save on BoardGameGeek", "Mark as owned", "Add price",
  "Not now", "Replace", "Keep <price>", "Sign in", "Sign in to BoardGameGeek", "Sign out of
  BoardGameGeek", "Save username", "Reset colours".
- Toasts: "Saved on BoardGameGeek", "Saved on BoardGameGeek: <game> owned[, price paid added]",
  "Signed in to BoardGameGeek as <name>", "Signed out of BoardGameGeek on this device".
