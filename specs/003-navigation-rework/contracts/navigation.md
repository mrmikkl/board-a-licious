# Contract: Navigation, routes and actions per screen

The UI contract of the app shell after feature 003. Tests (unit and Playwright) check exactly this.

## App bar (every screen)

| Element | Role / name | Behaviour |
|---|---|---|
| logo | image, decorative (`alt=""`) | none |
| "Board-a-licious" | text (not a heading; each screen has its own `h1`) | none |
| ☰ | button "Menu", `aria-expanded`, `aria-controls` → menu | toggles the menu |

## Menu

`nav` "Menu" with links, in this order, the current one `aria-current="page"`:

| Link | Goes to | Current on |
|---|---|---|
| Collections | `#/collections` | collections, collection, swipe, shared |
| BGG lists | `#/lists` | lists, list |
| Search | `#/search` | search |
| Config | `#/config` | config, share |

Closes on: choosing a link, Esc, scrim tap, any route change. Focus: into the current link on
open, back to ☰ on Esc/scrim.

## Action bar and main button per screen

| Route | Action bar | Main button (accessible name → effect) | Other actions |
|---|---|---|---|
| collections | yes | ＋ "Create a collection" → `#/collections?new` (New collection sheet) | — |
| collection | yes | ♥ "BG-Tinder: swipe a BGG list into this collection" → `…?add=list` (❤️ BG-Tinder ❤️ sheet) | left: "Add game" (＋) → `…?add=game`; right: "Filter" (shows "(active)" in its name while narrowed) → Filter and group sheet |
| lists | yes | ＋ "Load a BGG list" → `#/lists?load` (Load a BGG list sheet) | — |
| search | yes | 🔍 "Search (not available yet)", `disabled` | — |
| config, share, list, swipe, shared | no | — | — |

## Screen heading

| Route | `h1` | Before | After |
|---|---|---|---|
| collections | Collections | — | — |
| collection | collection name (ticker when too long) | — | ✏️ button "Edit <name>" → Edit collection sheet |
| lists | BGG lists | — | — |
| list | list title | ‹ "Back" → `#/lists` | — |
| swipe | Add to <collection> | ‹ "Back" → the collection | — |
| search | Search | — | — |
| config | Config | — | — |
| share | Share and backup | ‹ "Back" → `#/config` | — |

## Sheets opened by routes

| Hash | Sheet | Closing (Cancel, Esc, scrim, pull down) |
|---|---|---|
| `#/collections?new` | New collection: Name, Cancel / Create collection → `#/collections/<new id>` | replaces with `#/collections` |
| `#/lists?load` | Load a BGG list: link + hint, Cancel / Load list → `#/lists/<kind>/<id>` | replaces with `#/lists` |
| `#/collections/<id>?add=game` | Add game (001) | replaces with `#/collections/<id>` |
| `#/collections/<id>?add=list` | ❤️ BG-Tinder ❤️ (001's Add by list, renamed) | replaces with `#/collections/<id>` |

## Old addresses

| Hash | Opens |
|---|---|
| `#/add` | `#/collections` |
| `#/add/collection` | `#/collections?new` |
| `#/add/list` | `#/lists?load` |
| `#/add/game` | `#/collections` |

## Links that pointed at the add screen

| Where | Now |
|---|---|
| Share and backup: "Create a collection" | `#/collections?new` |
| A failed / missing list: "Load a BGG list" | `#/lists?load` |
| Membership sheet: "Create a collection" | `#/collections?new` |
| Search placeholder: add game link | removed |
| Not a BoardGameGeek game: "Add game by link" | `#/collections/<last share collection>?add=game` (else `#/collections?new`) |
| BGG lists: "Load a BGG list" card and button | removed (main button) |
| Collections: "Create a collection" card | removed (main button) |

## Icons (manifest and page)

| File | Use |
|---|---|
| `/icons/icon-192.png`, `/icons/icon-512.png` | manifest, `purpose: any` |
| `/icons/icon-maskable-512.png` | manifest, `purpose: maskable` |
| `/icons/apple-touch-icon.png` | `<link rel="apple-touch-icon">` |
| `/icons/favicon.png` | `<link rel="icon">` |
| `/icons/logo.png` | app bar logo |
