# Design rules

**Version**: 2.2.0 | **Agreed**: 2026-10-17 | **Amended**: 2026-10-22 | **Reference**: [prototype](../specs/001-bgg-game-collection/design/prototype.html),
[share prototype](../specs/002-share-from-bgg/design/prototype.html), [navigation prototype](../specs/003-navigation-rework/design/prototype.html),
[show-off prototype](../specs/004-show-off-gallery/design/prototype.html),
[Essen feedback prototype](../specs/005-essen-feedback/design/prototype.html)

The look and feel of Board-a-licious for every feature. Plans and implementations follow these
rules; changing one means a new version of this file (see [Spec Kit extended](speckit-extended.md),
extension 2). Where the prototype and this file disagree, this file wins.

## 1. Character

Dark, modern, poppy. **Orange is the one highlight**, cool gradients add depth, and the
**hexagon** is the recurring shape: the logo, covers, buttons for categories, the main button, badges,
dots, background. Playful details reward actions, but nothing gets in the way on a phone at a busy fair.

## 2. Foreground and background (the most important rule)

- It must be **obvious what can be tapped**. Everything interactive is a **solid, opaque, raised
  surface** (fill + border + shadow `--lift`). Nothing interactive is see-through.
- Decoration is **never** styled like a control: no outlined shapes in the content area that look
  like buttons, no "+" on decorative shapes.
- The background is **texture, not content**: low contrast, fading towards the bottom, never
  competing with text.
- Text that is not tappable (headings, hints) sits directly on the background without a surface.

## 3. Colour

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0D0F1F` | page |
| `--deck` / `--deck-2` | `#151831` / `#1D2142` | surfaces / raised surfaces |
| borders | `#3A4078` (default), `#4A5196` (secondary buttons) | surface edges |
| `--text` / `--muted` | `#ECEEFF` / `#9AA0C8` | text / secondary text |
| `--orange` → `--orange-2` | `#FF7A1A` → `#FFB020` | the highlight: primary actions, focus, Must Have |
| `--danger` | `#FF4D5E` | destructive actions, Not interested |

Gradients (all 135°):

| Name | Colours | Meaning |
|---|---|---|
| hot | `#FF7A1A` → `#FFB020` | primary, Must Have |
| cool | `#4C5BFF` → `#14C8C8` | Interested, swipe "add" |
| violet | `#6D4AE0` → `#A78BFA` | Unsure |
| pink | `#D946EF` → `#F9A8D4` | For later |
| mud | `#7A6046` → `#B0916E` | Poop |
| red | `#C2183A` → `#FF4D5E` | Not interested, swipe "nope" |
| got | `#0FB98F` → `#7CF0C5` | Bought |
| dusk | `#8B5CF6` → `#4C5BFF` → `#14C8C8` | neutral decoration, collection cards |

Contrast: body text ≥ 4.5:1 against its surface (WCAG 2.2 AA). Text on a gradient pill or badge
is checked against the gradient's least contrasting colour: dark text (`--ink`) on hot, cool, pink, got
and white; white text on red, violet, mud and dusk, made bold at ≥ 14px where needed to reach 3:1
for large text. State is never shown by colour alone; every category also has its emoji and label.

## 4. Categories and their symbols

What a person thinks of a game is its **category** (the word on every screen; "mark" and "group"
are no longer used for it).

| Category | Emoji | Gradient |
|---|---|---|
| No category yet | ⬡ (white hexagon) | white |
| Must Have | ⭐ | hot |
| Interested | 👀 | cool |
| Unsure | 🤔 | violet |
| For later | ⏳ | pink |
| Poop | 💩 | mud |
| Not interested | 🛑 | red |
| Bought (independent tick) | ✅ | got |

Order everywhere (filters, counts, pickers, share text): No category yet, Must Have, Interested,
Unsure, For later, Poop, Not interested. **Groups in a collection** are the exception: the
categorised games first (Must Have, Interested, Unsure, For later, Poop), then a separator, then No
category yet and Not interested. Bought is shown as a badge and on the Buy action, never as a group.

## 5. Typography

- **Chakra Petch** (600–700) for display: screen titles 26px, section titles 18px, game names in
  details 23px, numbers in counters. Angular, matches the hexagons.
- **Manrope** (400–700) for everything else: body 15px/1.5, hints 13–14px.
- Sentence case everywhere. No all-caps labels (only the "GOT IT!" stamp and swipe stamps).
- Line length under 80 characters; hints may wrap.

## 6. Shape and spacing

- **Hexagon** (pointy top, `polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)`) for
  covers, the state picker, the add button, the logo, dots, badges' bullets.
- Rounded rectangles for surfaces: 16px (`--r-md`) for fields, buttons, rows; 24px (`--r-lg`) for
  cards and sheets. Pills (999px) for badges and chips.
- Phone column max 440px, side gutter 16px, touch targets ≥ 44px, list gap 8px.
- From 768px wide (tablets, laptops) the column grows to 1040px: collection cards and game rows
  flow into a grid; sheets (560px), the swipe card, the intro and forms keep a readable width; the
  action bar stays phone-sized and centred.
- **Screen layout, top to bottom**: the **app bar** (the same on every screen), the **screen
  heading**, the content, the **action bar** (only on screens with actions). Navigation lives only
  in the app bar's menu; actions live only in the action bar and in sheets. Nothing at the top of a
  screen is an orange primary button.
- **Screen heading**: the screen title (22px on phones, 26px from 600px) on the background below
  the app bar; a back button (‹) before it only on screens reached from another screen's content
  (a single BGG list, Swipe, Share and backup, Show-off). Places in the menu have none. A single
  BGG list carries a **Resync with BGG** icon button (two circling arrows) at the right of its heading.
- **Collection screen**: heading = the collection's name and a pencil (✏️ icon button) directly after
  it, which opens "Edit collection". No back button (the menu leads back). Below: the bought line,
  the separator, the **quick filters**, a second separator, the **search**, the groups. No line
  describing the active filter: the highlighted Filter action is enough. Action bar: Add game · ♥ ·
  Filter · Show-off.

## 7. Components

| Component | Rules |
|---|---|
| **Primary button** | hot gradient, dark text; one per area; inside sheets and empty states only, never in a screen's heading (the main button is the screen's one orange action). |
| **Secondary button** | solid `#232852`, border `#4A5196`; fills orange on hover. |
| **Destructive button** | secondary look with red text; fills red on hover. |
| **Bought button** | got gradient. |
| **Card** (collection, BGG list) | solid surface, title, counts; a **cluster of hexagons in the top-right corner** (violet→teal) that glows and sways slowly. Creating a collection or loading a list is the main button's job; there is no "create" card. |
| **Game row** | solid tile whose **whole border (1px, the usual width) has the category's gradient** (No category yet: the default border colour); no category pill or icon. Left part (a button opening the details): hexagon cover (with ✓ badge when bought); line 1 name and year; line 2 the publisher (muted, left out when unknown); line 3 the first available **game infos** (grouped by booth: the booth, or "Hall 3, booth unknown" in amber). **Right part: two row actions**, each a 32px hexagon with a small label below in a ≥ 44×52px target: **Buy** (bag icon; when bought it fills with the got gradient, a bag with ✓, and its label shows the price paid or "Bought") and **Category** (neutral two-hexagon icon on a raised hexagon, label "Category"). Accessible names "Buy <game>" / "Not bought <game>" and "Category of <game>"; the row's name includes category and bought. Not-interested rows are dimmed and struck through. |
| **Game info** | always in this order, each left out when unknown: price, number of players ("1–4 players"), booth, edition, designer(s), mechanisms. Game details and a list game's sheet add **Rating** and **Geek rating** after players, each as its value with one decimal in a small hexagon (rating: cool gradient, dark text; geek rating: dusk gradient, white text); rows and the swipe card leave them out. Text infos are joined with " · "; mechanisms are small outline pills that wrap. Rows show the first three available; game details, the swipe card and a list game's sheet show all. No note when something is missing. |
| **Group heading** | small coloured hexagon, label, rolling count. Every group in a collection (each category, each hall, "No booth yet") folds with a chevron (the whole heading is the button; the count stays visible while folded); all open expanded except For later, Poop and Not interested, which open collapsed; folding is not remembered between visits. |
| **Filter and group** | the Filter action in the collection's action bar (its icon and label turn orange-highlighted with a hexagon dot whenever filter or grouping differ from the default, including the Buy quick filter) opens the sheet "Filter and group": a Bought segment (All / Not bought / Bought), a Price segment (All / ≤ €30 / €30–60 / > €60), "Categories" with a checkbox, emoji and count per category and "Select all" / "Select none", "Group by" segment (Categories / Booths); at the bottom **Clear filters** (left, disabled at the default) and **Done** (right). Changes apply at once. Default: Bought All, Price All, all categories, Group by Categories. Grouping by booth shows exactly what the filter lets through (Not interested too when selected); a booth given as a hall number only ("3", "Hall 3") counts as that hall, after the full booths; games without a booth go to "No booth yet". Segments keep all options in one row. |
| **Quick filters** | a row between the collection's two separators: the **Cat \| Booth** toggle (one pill with both words; the current grouping filled hot; a tap switches; the same setting as "Group by") and the **🛒 Buy** chip (filled hot while on: only Must Have, Interested and Unsure games not bought; off restores the filter before; any change in the filter sheet turns it off); the number of games shown, muted, at the right. |
| **Search in a collection** | a field with a search icon, "Search this collection", below the second separator; narrows the games by name as you type (case and accents ignored) within filter and grouping; no match: "No game called “…” here." with **Clear the search**. Not remembered. |
| **Category sheet** | opened by a row's Category action: "Category of <game>", a list of the categories as 52px rows (gradient hexagon, emoji, name), Must Have to Poop, a thin line, then No category yet and Not interested; the current one has an orange border, glow and "current". A tap sets it, closes the sheet and shows a toast "<game> → ⭐ Must Have". |
| **Buy sheet** | opened by a row's Buy action (or "✅ Bought it" in the details): "Bought <game>?", "What did you pay? Leave it empty to just tick it off.", price field (listed price as placeholder) and currency dropdown, Cancel / **Got it** (got gradient); saving celebrates as Bought does and toasts "<game>: got it for €24!". Buy on a bought game marks it not bought at once with the toast "<game>: not bought any more" (no sheet). |
| **Separator** | 2px orange → violet line between the top of a screen and its content, and in a collection between the categorised games and the rest (No category yet, Not interested). |
| **Hexagon picker** | 3–4 equal hexagons in one straight, centred row; selected = filled with its gradient. |
| **Category picker** | in a game's details, directly under the cover and name, above the info box: Must Have, Interested, Unsure, For later and Poop as a **honeycomb of pointy-top hexagons, three on top and two below** (1st top left, 2nd below right of it, 3rd top, 4th below, 5th top right; 4px gaps; at most 88px wide each); emoji over the label; the selected one filled with its gradient and an orange rim; a tap changes the category in place. Below, a link "🛑 Not interested" (on a Not-interested game: "↩ Interested again"). |
| **Sheet** | bottom sheet for details and for adding; a sheet that asks for a choice ends with Cancel (left) and its one action (right) side by side, the action named for what it does (Select, Load list, Add to collection); closes with Esc, scrim tap, Cancel or by pulling it down on a touch screen (from the handle, or anywhere while scrolled to the top; 100px, or a quick flick of 40px); never saves without an explicit button. |
| **BG-Tinder** (add by list) | opened by the ♥ main button in a collection: sheet titled "❤️ BG-Tinder ❤️", one line explaining the swiping (right adds the game, left passes on it, decided games don't come back), then a segment "Select list" / "Add new list" (Select list first when lists are loaded). Select list: the loaded lists as cards; the chosen one gets an orange border, glow and a hexagon tick; lists with every game seen are dimmed and disabled; action "Select". Add new list: the BGG list link with its hint; action "Load list". Either opens Swipe for that list. |
| **Add game** | opened by Add game (＋) in the collection's action bar: sheet titled "Add game": one line saying it is for games not on any list, the BoardGameGeek link with the recognised game and editable name, a note when the game is already in the collection; action "Add to collection". |
| **Shared game** | what opens when a BoardGameGeek page is shared to the app (from the BGG app or the browser): the "Add game" sheet over the collection shared into last (else the collections screen). Top: the hexagon cover beside the editable name and a muted "Shared from BoardGameGeek". Then the **collection dropdown** with the collection shared into last preselected and marked "(last used)"; collections that already hold the game are marked "(already in it)". One hint line below the dropdown: "Preselected: the collection you last shared into", or in red "<Game> is already in <collection>. Pick another collection." (then the action is disabled). Offline: a framed note that the game is added now and its cover and details follow. Actions: Cancel / **Add to collection**; adding opens that collection with the new row highlighted and the toast "Added <game> to <collection>". No collection yet: a collection name prefilled "SPIEL 2026" and the action **Create and add**. A shared page that is no game: sheet "Not a BoardGameGeek game" with the shared link, Close / **Add game by link**. A shared BGG list opens that list. |
| **Choosing a collection** | in a sheet, one collection out of many is chosen with a **dropdown** (cards grow too long with many collections); cards are for a few rich choices such as loaded lists. |
| **Hidden taps** | a heading that counts taps (Config: five taps within 4 s show or hide the developer section) does not select text, does not zoom on double tap and takes the title's full width. |
| **Multi-choice list** | rows with a hexagon tick; the ticks always show the current truth; changes apply on "Done". |
| **Inputs** | solid field with label or icon; the primary button stays disabled until the input is valid. Dropdowns use the same field look with an orange hexagon as arrow. |
| **Swipe card** | big cover, name, year, publisher, description (3 lines), all game infos; ✓/✕ hexagon buttons below; arrow keys work. |
| **Empty state** | centred: decorative hexagon (no symbol), one heading, one hint, the actions as buttons. |
| **Toast** | dark pill above the action bar (near the bottom where there is none), one short sentence. |
| **Share hint** | in Config, only while the app is not installed to the home screen: a card "📲 Share from BoardGameGeek" saying that once board-a-licious is on the home screen, games can be shared to it from the BGG app or website, and how (Chrome menu ⋮ → Add to Home screen). |
| **App bar** | its own band at the very top of every screen, about 48px high, sticky: hot gradient background; the **logo** at the left (34px, `hex-gradient-colour`, the colourful meeple on the teal→orange hexagon); "Board-a-licious" centred (Chakra Petch 19px, dark text); the **menu button** (☰, 38px, translucent dark) at the right. Nothing else goes in it. |
| **Menu** | opened by ☰: a solid panel just below the app bar at the right, one row per place (icon + label, ≥ 48px): Collections, BGG lists, Search, Config; the current place has a raised background and an orange icon. Choosing a row goes there and closes the menu; a scrim tap, Back or Esc closes it. New places are added here, not elsewhere. |
| **Image viewer** | opened by tapping a cover in a game's details sheet (collection or BGG list; the cover carries a small ⤢ badge) or a hexagon in Show-off: full screen on near-black (`#05060E`, opaque); top row: the game's name, the position ("3 / 24") when there are several images, ✕ (44px, round); the image fitted (never cropped) in the middle; below: hexagon dots (current one orange, at most 12) and a caption ("Components · from BoardGameGeek"). Swipe sideways or ←/→ (‹ › buttons on pointer devices) to move through the game's BoardGameGeek gallery; no wrap-around: past the first or last image the drag resists (a third of the finger's way) and springs back. Swipe down (100px), ✕, Back or Esc closes it, back to where it was opened. One image only: no position, dots or arrows; a muted line says why (offline, no more images, details pending). |
| **Resync and conflicts** | the Resync icon in a single BGG list's heading spins while the list is read again; the list's status line and progress bar show "Resyncing with BGG… 340 / 1,204"; at the end a toast "Resync done: 4 games updated, 3 conflicts". With conflicts, a sheet "3 conflicts": "You typed these in yourself, and BGG now says something else. Choose what to keep."; **Use BGG for all** / **Use own for all** side by side (each applies and closes at once); then per conflict the game's name, "<field> · in <collection>" (muted) and two choice tiles **Own** / **BGG** with the values (Own preselected, the chosen one with an orange border and glow); at the bottom Later (keeps own values, asks again next time) / **Apply**. |
| **Show-off** | a collection's action (honeycomb icon of three hexagons) opens a sheet "Show-off" with the seven categories as a multi-choice list (emoji, label, count; hexagon tick filled hot when chosen), Cancel / **Show off** (disabled while none is chosen); the choice is remembered per collection, first time Must Have. The Show-off screen (‹ back to the collection) has the heading "Show-off", a muted line "<collection> · <category emojis> · <n> games", and the **honeycomb**: the covers as pointy-top hexagons filled edge to edge, three per row, every other row shifted by half a hexagon, rows interlocking (4px gaps); bought games carry the ✓ badge at the bottom; no names on the hexagons (accessible name: game and category). Tapping a hexagon opens the image viewer. |
| **Action bar** | fixed at the bottom on screens with actions, phone-sized and centred, fading into the page like a dock: a 5-column row with the **main button** in the middle and the screen's own actions (icon + small label, muted, ≥ 52px) beside it; the columns next to the main button come first, a fourth action takes the outer right column (a collection: Add game · ♥ · Filter · Show-off). Not shown on Config, a single BGG list, Swipe, Share and backup. Sheets cover it. |
| **Main button** | the big hot hexagon in the action bar, the screen's one orange action; its icon says what it does: Collections ＋ (New collection sheet), a collection ♥ (BG-Tinder), BGG lists ＋ (Load a BGG list sheet), Search 🔍 (disabled until search exists: raised grey, no shimmer). A light shimmer passes over it every 5 s. Its accessible name says the action ("Create a collection", "BG-Tinder: swipe a BGG list into this collection", "Load a BGG list", "Search (not available yet)"). |
| **New collection** | sheet from the Collections main button: Name, Cancel / **Create collection**; opens the new collection. |
| **Load a BGG list** | sheet from the BGG lists main button: while the SPIEL Essen 2026 preview is not on the device, a chip "✨ Try the SPIEL Essen 2026 preview" above the link field fills in its link (also in BG-Tinder's "Add new list"); the preview or geeklist link with its hint (example, preview / geeklist, or what is wrong), Cancel / **Load list** (disabled until the link is valid); opens the list and starts loading. |
| **Edit collection** | sheet from the pencil beside a collection's name: Name with **Save name**, then **Delete collection…** (with the existing confirmation) and Cancel. |
| **Ticker** | a heading too long for its row (a collection's name before the pencil) shows its start, then scrolls left at about 50px/s until its end is visible, pauses and starts over; soft fades at both edges. Shorter names stand still. |
| **App icon** | `specs/003-navigation-rework/design/icons/`: the home-screen icon is `hex-gradient-colour` (512px; plus a version on a full square background for Android's cropped "maskable" icons); the browser tab uses `favicon-color`. |

## 8. Interaction states

- **Hover (pointer devices)**: nothing moves. Cards, rows and tiles get an orange border and an
  outer glow; outlined buttons fill orange; primary buttons glow; hexagon buttons grow 7% and
  brighten. No inner spotlight.
- **Press**: a short squish (cards 98%, buttons 96%, hexagons 90%) that springs back, plus an
  orange hexagon pulse expanding from the tap point.
- **Focus**: 2px orange outline, offset 2px.
- **Disabled**: 45% opacity, no hover effect.
- **Touch**: phones have no hover; press squish and the tap pulse are the feedback there, and
  nothing is reachable or understandable only by hovering.

## 9. Motion

- Springy easing `cubic-bezier(.34, 1.56, .64, 1)` for things that settle; 200–500ms.
- **Must Have**: a burst of ~20 small hexagons from the button.
- **Bought**: "GOT IT!" stamp in the centre plus a burst.
- **Swipe**: card follows the finger with tilt and growing ADD/NOPE stamps; snaps back with
  overshoot; leaves with a fling; the next card pops up from behind.
- **Counters** roll from the old to the new value (650ms) and flash amber.
- **Sheets** slide up only when they open (and down when they close); what changes inside an open
  sheet (a dropdown choice, a hint, an enabled button) updates in place, without replaying the slide.
- **Just added**: a game row that was just added (e.g. from a share) carries the orange border and
  glow of the hover state until the user scrolls or taps elsewhere.
- **Background**: a faint honeycomb on a deep blue-violet gradient; slow light waves fill cells in
  violet→orange, and every ~0.5–1.2s a single cell lights up orange or teal and fades. Low contrast,
  brightest at the top, ~30fps, paused in hidden tabs.
- **Menu**: fades and grows in from the menu button (180ms); closes at once.
- **Image viewer**: fades in (180ms); a step slides the images (280ms) and updates the position,
  dots and caption in place, never redrawing the viewer (nothing of the screen behind may flash);
  dragging follows the finger; swiping down moves the image with the finger and fades the backdrop.
- **Ticker**: see Components; one loop is at least 4 s.
- **Reduced motion**: all of the above is switched off: background (one still frame), bursts,
  stamp, counter rolls and flashes, tap pulses, press squish, the shimmer on the main button, the
  menu's grow-in, the ticker (the name ends in "…" instead), the image viewer's fade and slide (images
  change at once), and the swipe tilt, fling and pop-in (the card changes without animation).

## 10. Sound and haptics

- A short synthesised **dice roll** on every category change; bought adds a two-note chime. The "Sound and
  vibration" switch in Config mutes it; the choice is remembered.
- **Vibration** (Android browsers): short tick per category change or swipe, double for Must Have, longer
  pattern for bought. iPhone browsers offer no web vibration; nothing happens there.

## 11. Content and voice

- Plain verbs, sentence case, no filler; buttons say what happens ("Add game", "Save, got it").
- Errors say what is wrong and how to fix it; nothing apologises.
- Empty screens invite the next action.
- Game covers come from BoardGameGeek; until then initials in a hexagon.

## 12. Onboarding

Three swipeable cards on first start (Collections, Geeklists, Swipe then hunt) with floating
hexagon illustrations, Skip and Next/"Let's go"; can be shown again from Config.
