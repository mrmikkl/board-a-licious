# Feature design: BGG Statuses, Buy and Lists

**Design rules**: [docs/design.md](../../docs/design.md) v3.0.0 | **Prototype**: [design/prototype.html](design/prototype.html)
| **Agreed**: 2026-11-08

Open the prototype in Chrome, switch the developer tools to device mode (phone size) and pick a
starting point in the black bar ("Start"). The switches in that bar simulate being signed in to
BoardGameGeek, being offline and BoardGameGeek refusing a save. Games, statuses and friends are
stand-ins; no network, no real sign-in (the password "wrong" shows the error).

## Where the feature lives

- **Menu**: three places, **Buy**, **Lists**, **Config**. The Search place, the Collections place
  and the BGG lists place are gone; their content moved into the tabs below.
- **Buy**: tabs **Search** (find any game; a tap opens its sheet) and **Shopping lists** (today's
  collections).
- **Lists**: tabs **Status lists**, **Previews**, **Geeklists**.
- **Game sheet**: everywhere a game is opened; badges next to the cover, folded Category (shopping
  lists only), BGG status and Prices sections.
- **Config**: BoardGameGeek (username, sign-in) and Badge colours.

## Screens and flows

| Screen | Content | Leads to |
|---|---|---|
| **Menu** | Buy (bag with €), Lists, Config (cog) | the place, on its last used tab |
| **Buy › Search** | place tabs; "Find a game"; search field (0.75 s pause); status line; **list game rows** (badges, "in …", **Add** inside the row); no action bar | a row: game sheet; Add: add to shopping lists sheet |
| **Buy › Shopping lists** | place tabs; shopping list cards; main button ＋ (New shopping list) | a card: the shopping list |
| **Shopping list** | ‹ back (to Buy › Shopping lists), name; bought line; separator; quick filters (Cat \| Booth, 🛒 Buy, count); separator; groups by category (or hall and booth); **game rows** with price · booth, badges, Buy and Category actions; action bar Add game · ♥ · Filter · Show-off | row: game sheet; Buy: buy sheet → mark as owned sheet; Category: category sheet; Filter: filter sheet (with BGG status) |
| **Lists › Status lists** | place tabs; "Mine · <username> on BoardGameGeek · loaded …"; one **status list card** per status with games (status hexagon in its badge colour, name, count, ›); below, per friend loaded by link: "<name> · loaded by link · read-only" and their cards; main button ＋ (Load a BGG list, also a BGG collection link); without username: empty state "What you own, wish for and want to play" with **Add username in Config** | a card: the status list |
| **Lists › Previews / Geeklists** | place tabs; the loaded lists of that kind as cards (today's BGG lists) | a card: the list as today |
| **Status list** | ‹ back, "Wishlist" (friend: "anna_meeple: Wishlist"), Read again from BGG (resync icon); "<user> on BoardGameGeek · loaded 12 min ago"; separator; list game rows; Wishlist grouped by priority (1 Must have … 5 Don't buy this); preparing: spinner line "BoardGameGeek is preparing your collection… it loads by itself when ready" with placeholder rows | a row: game sheet |
| **Game sheet** | name; cover with, right of it, **year · publisher**, **all badges** (or "Not in your BGG collection"), **"in <list>"** line (tappable); below the cover **Open on BoardGameGeek ↗**; info box; **Category** (folded, shopping lists only); **BGG status** (folded); **Prices** (folded); actions: shopping list → ✅ Bought it, Copy · Move, Remove from <list>; elsewhere → **Add to shopping lists** (primary), ✅ Bought it; description; Close | Bought it: buy sheet; BGG status: save on BGG or sign in |
| ↳ Category section | header 🏷️ Category with the current category (hexagon in its colour, emoji, name), ›; unfolded: the category list of the category sheet (current one marked) | a tap sets it, folds the section, toast "<game> → 👀 Interested" |
| ↳ BGG status section | header 📦 BGG status with up to two badges (+n) or "not in your collection", ›; unfolded: one line ("Signed in as …" / "Sign in to BoardGameGeek to change them." / "Changing statuses needs a connection."), a switch per status labelled with its badge, Wishlist priority segment 1–5 with its name; changed lines marked "· changed"; **Save on BoardGameGeek** (disabled until something changed) or **Sign in to save on BoardGameGeek**; failure: red line "BoardGameGeek did not take the change. Nothing was changed." with Try again | saved: sheet closes, toast "Saved on BoardGameGeek" |
| **Buy sheet** | as today ("Bought <game>?", price, currency, Cancel / Got it) | Got it: mark as owned sheet (when not owned or a price was entered) |
| **Mark as owned sheet** | "Also mark as owned on BoardGameGeek?" (owned already: "Add the price paid on BoardGameGeek?"); what will be written as a framed list (Status Owned, Price paid, Acquisition date, Acquired from); "Price, date and where from go into the game's private info on BGG, which only you see."; not signed in: "You'll sign in to BoardGameGeek first (once on this device)."; Not now / **Mark as owned** (or **Add price**) | saving line, then toast "Saved on BoardGameGeek: <game> owned, price paid added" |
| **Replace price sheet** | "Replace the price paid on BoardGameGeek?"; the old price struck through next to the new one; **Keep 39,99** / **Replace** | saves |
| **Sign in sheet** | "Sign in to BoardGameGeek"; "Your password is used once to sign in and is not kept. The sign-in stays on this device."; BGG username, Password; error "BoardGameGeek did not accept this username or password."; Cancel / **Sign in** | back to what asked for it |
| **Config › BoardGameGeek** | "Your BGG username" field with its hint and **Save username**; "Change statuses on BGG": not signed in → explanation and **Sign in to BoardGameGeek**; signed in → "Signed in to BoardGameGeek as <name> on this device", explanation, **Sign out of BoardGameGeek** (destructive) | — |
| **Config › Badge colours** | hint; one row per status (its badge, "Change"); **Reset colours** (disabled at the default) | a row: colour sheet |
| **Colour sheet** | "Colour of “Owned”", the badge preview, ten hexagon swatches (Cool, Hot, Mint, Pink, White, Violet, Dusk, Red, Mud, Grey; current one ✓ with an orange rim) with their names below, **Done** | a swatch applies at once |
| **Filter sheet** | as today plus a **BGG status** segment (All / Owned / Not owned / Wishlist) after Price | — |
| **BG-Tinder card** | as today plus the badges under "publisher · year" | — |

## Components used

From [docs/design.md](../../docs/design.md) v3.0.0: **Place tabs**, **BGG status badge**, **List
game row**, **Status list card**, **Game sheet**, **Category section**, **BGG status section**,
**Mark as owned sheet**, **Sign in to BoardGameGeek**, **Badge colours** (all new); Menu, Buy, Game
row, Filter and group, Main button, Action bar, Load a BGG list (changed); Game row, Quick filters,
Group heading, Category sheet, Buy sheet, Prices section, Offers block, Segment, Switch, Empty state,
Separator, Screen heading, Toast (unchanged).

## Decisions from the review (2026-11-08)

- **Menu: Buy, Lists, Config.** Buy has the tabs Search and Shopping lists; Lists has Status lists,
  Previews and Geeklists (in this order); each place opens on its last used tab.
- **"Collection" is called "shopping list"** on screen; code, data and share format keep the name.
- **A search result opens the full game sheet**; the separate price screen of feature 007 is gone
  (prices are the folded Prices section).
- **Category only in shopping lists**: rows elsewhere have just **Add**, and it sits **inside the
  row** like Buy and Category (no + hexagon outside the row any more).
- **Each status has its own badge colour**, chosen in Config › Badge colours; badges always carry
  their text.
- **Game sheet head**: year · publisher, badges and "in <list>" right of the cover; "Open on
  BoardGameGeek" below it. Many lists collapse to "in 3 shopping lists ›" (tap: the shopping list
  choice with ticks); inside a shopping list only the others ("also in …").
- **Game sheet order**: info box, Category (folded; replaces the hexagon picker; same list as the
  Category action), BGG status (folded; header shows the badges; chosen over an always-open section
  under the cover), Prices (folded).
- **Buying offers "mark as owned"** with price paid, acquisition date and acquired from (booth, else
  shop) written to BGG's private info; an existing price is only replaced after asking.
- A shopping list now has a **back button** to Buy › Shopping lists, because it is opened from that
  tab's content.
