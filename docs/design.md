# Design rules

**Version**: 1.0.0 | **Agreed**: 2026-10-17 | **Reference**: [prototype](../specs/001-bgg-game-collection/design/prototype.html)

The look and feel of Board-a-licious for every feature. Plans and implementations follow these
rules; changing one means a new version of this file (see [Spec Kit extended](speckit-extended.md),
extension 2). Where the prototype and this file disagree, this file wins.

## 1. Character

Dark, modern, poppy. **Orange is the one highlight**, cool gradients add depth, and the
**hexagon** is the recurring shape: covers, buttons for marks, the add button, badges, dots,
background. Playful details reward actions, but nothing gets in the way on a phone at a busy fair.

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
| `--orange` → `--orange-2` | `#FF7A1A` → `#FFB020` | the highlight: primary actions, focus, Essen, Must Have |
| `--danger` | `#FF4D5E` | destructive actions, Not interested |

Gradients (all 135°):

| Name | Colours | Meaning |
|---|---|---|
| hot | `#FF7A1A` → `#FFB020` | primary, Must Have, Essen |
| cool | `#4C5BFF` → `#14C8C8` | Interested, swipe "add" |
| violet | `#6D4AE0` → `#A78BFA` | Unsure |
| mud | `#7A6046` → `#B0916E` | Poop |
| red | `#C2183A` → `#FF4D5E` | Not interested, swipe "nope" |
| got | `#0FB98F` → `#7CF0C5` | Bought |
| dusk | `#8B5CF6` → `#4C5BFF` → `#14C8C8` | neutral decoration, standard collections |

Contrast: body text ≥ 4.5:1 against its surface (WCAG 2.2 AA). State is never shown by colour
alone; every mark also has its emoji and label.

## 4. Marks and their symbols

| Mark | Emoji | Gradient |
|---|---|---|
| Not yet marked | ⬡ (white hexagon) | white |
| Must Have | ⭐ | hot |
| Interested | 👀 | cool |
| Unsure | 🤔 | violet |
| Poop | 💩 | mud |
| Not interested | 🛑 | red |
| Bought (independent tick) | ✅ | got |

Order everywhere (groups, filters, counts, share text): Not yet marked, Must Have, Interested,
Unsure, Poop, Not interested. Bought is shown as a badge, never as a group.

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

## 7. Components

| Component | Rules |
|---|---|
| **Primary button** | hot gradient, dark text; one per area. |
| **Secondary button** | solid `#232852`, border `#4A5196`; fills orange on hover. |
| **Destructive button** | secondary look with red text; fills red on hover. |
| **Bought button** | got gradient. |
| **Card** (collection, geeklist) | solid surface, title + Essen badge, counts; a **cluster of hexagons in the top-right corner** (hot for Essen, violet→teal for standard) that glows and sways slowly. The "create" card is dashed orange and fills orange on hover. |
| **Game row** | solid tile: hexagon cover (with ✓ badge when bought), name, booth/price/publisher line (Essen) or year, mark pill (+ "✅ €paid" pill when bought). Not-interested rows are dimmed and struck through. |
| **Group heading** | small coloured hexagon, label, rolling count. "Not interested" is collapsed by default with a chevron. |
| **Filter** | one full-width button showing the selection and count; opens a panel with presets ("All", "⭐ Must Have, not bought"), a Bought segment (All / Not bought / ✅ Bought) and a checkbox per group. |
| **Separator** | 2px orange → violet line between the controls of a screen and its content. |
| **Hexagon picker** | 3–4 hexagons in a honeycomb (every second one offset down); selected = filled with its gradient. Used for marks and for "what to add". |
| **Sheet** | bottom sheet for details; closes with Esc, scrim tap or Cancel; never saves without an explicit button. |
| **Multi-choice list** | rows with a hexagon tick; the ticks always show the current truth; changes apply on "Done". |
| **Inputs** | solid field with label or icon; the primary button stays disabled until the input is valid. Dropdowns use the same field look with an orange hexagon as arrow. |
| **Swipe card** | big cover, name, year, description (3 lines), facts; ✓/✕ hexagon buttons below; arrow keys work. |
| **Empty state** | centred: decorative hexagon (no symbol), one heading, one hint, the actions as buttons. |
| **Toast** | dark pill above the tab bar, one short sentence. |
| **Badge "Essen"** | orange outline pill with a small hot hexagon. |
| **Tab bar** | 4 tabs + the big hot hexagon "+" in the middle (opens the add choice); a light shimmer passes over it every 5 s. |

## 8. Interaction states

- **Hover (pointer devices)**: nothing moves. Cards, rows and tiles get an orange border and an
  outer glow; outlined buttons fill orange; primary buttons glow; hexagon buttons grow 7% and
  brighten. No inner spotlight.
- **Press**: a short squish (cards 98%, buttons 96%, hexagons 90%) that springs back, plus an
  orange hexagon pulse expanding from the tap point.
- **Focus**: 2px orange outline, offset 2px.
- **Disabled**: 45% opacity, no hover effect.

## 9. Motion

- Springy easing `cubic-bezier(.34, 1.56, .64, 1)` for things that settle; 200–500ms.
- **Must Have**: a burst of ~20 small hexagons from the button.
- **Bought**: "GOT IT!" stamp in the centre plus a burst.
- **Swipe**: card follows the finger with tilt and growing ADD/NOPE stamps; snaps back with
  overshoot; leaves with a fling; the next card pops up from behind.
- **Counters** roll from the old to the new value (650ms) and flash amber.
- **Background**: a faint honeycomb on a deep blue-violet gradient; slow light waves fill cells in
  violet→orange, and every ~0.5–1.2s a single cell lights up orange or teal and fades. Low contrast,
  brightest at the top, ~30fps, paused in hidden tabs.
- **Reduced motion**: all of the above is switched off; the background is one still frame.

## 10. Sound and haptics

- A short synthesised **dice roll** on every mark; bought adds a two-note chime. A 🔊/🔇 button in
  the header mutes it; the choice is remembered.
- **Vibration** (Android browsers): short tick per mark or swipe, double for Must Have, longer
  pattern for bought. iPhone browsers offer no web vibration; nothing happens there.

## 11. Content and voice

- Plain verbs, sentence case, no filler; buttons say what happens ("Add game", "Save, got it").
- Errors say what is wrong and how to fix it; nothing apologises.
- Empty screens invite the next action.
- Game covers come from BoardGameGeek; until then initials in a hexagon.

## 12. Onboarding

Three swipeable cards on first start (Collections, Geeklists, Swipe then hunt) with floating
hexagon illustrations, Skip and Next/"Let's go"; can be shown again from the collections screen.
