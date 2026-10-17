# Vision: Board-a-licious

## In one sentence

Board-a-licious is the pocket companion for board game fans who want to decide, before and at a
fair, which games they care about, where to find them, and what they already bought.

## Who it is for

A small group of friends (fewer than ten) who go to SPIEL Essen together and talk board games all
year. Everyone keeps their own lists; they share them with each other through the chat apps they
already use.

## The problem

- A SPIEL preview geeklist on BoardGameGeek has hundreds or thousands of entries. Going through it
  on a phone and remembering what looked interesting is tedious.
- At the fair you need booth, price and publisher at a glance, and you need to know what is still
  on your list and what you already bought.
- Notes in chats, screenshots and paper lists get lost and cannot be filtered.

## What it does

1. **Collections** of games, as many as you like. An **Essen** collection keeps booth, price and
   publisher for each game; a standard collection is a plain list.
2. **BGG lists** are loaded by their link once and browsed on the phone, also offline. The SPIEL
   preview is an Essen list: it brings booth, price and publisher.
3. **Swipe to sort**: go through a geeklist card by card; right adds a game to the collection, left
   marks it as not interesting.
4. **Marks** say how much you like a game: Must Have, Interested, Unsure, Poop, or Not interested.
   **Bought** is a separate tick on top, with the price you paid.
5. **At the fair**: filter to "Must Have, not bought", group by hall, walk to the booth, tick it
   off, and see what you have spent.
6. **Share** a collection as plain text into any chat, with booths and prices for Essen.

## What makes it feel right

- **Fast on a phone, one hand, poor network.** Everything that matters works offline.
- **Playful, not childish.** A dark, modern look with orange as the one highlight and hexagons as the
  recurring shape; small rewards (a burst of hexagons for Must Have, a "GOT IT!" stamp, a dice-roll
  sound) make marking games fun. Details: [design.md](design.md).
- **Always clear what you can tap.** Decoration stays in the background; everything interactive is a
  solid, raised surface.

## Principles for decisions

- The fair is the moment of truth: when in doubt, optimise for using the app on the fair floor.
- Own data first: each person's collections are theirs; sharing is an explicit action.
- BoardGameGeek is the source of game data; the app adds only what a person decides and observes
  (marks, bought, price paid, notes they type in).
- Small and polished beats big and rough (constitution IV).

## Not the goal

- Replacing BoardGameGeek (reviews, ratings, forums, logging plays).
- A marketplace, price comparison or purchase handling.
- Public sign-up or social features beyond sharing a list.

## Where it is going

| Horizon | What |
|---|---|
| Release 0.5 (before SPIEL Essen 2026, 22 Oct) | Collections, Essen facts, geeklists, swipe, marks, bought with price, filter, share/backup, offline; adding single games by link |
| Release 1.0 (once BGG grants API access) | Search across all of BoardGameGeek; data from the official API |
| Later ideas | Seeing friends' marks from shared lists, sharing straight from BGG into the app (Android) |

## Decisions from the design session (2026-10-17)

The clickable prototype ([specs/001-bgg-game-collection/design/prototype.html](../specs/001-bgg-game-collection/design/prototype.html))
changed the product in these ways:

- One collection per person became **many collections**, each **Essen** or **standard**.
- **Booth, price and publisher** come from the SPIEL preview (an Essen BGG list) into Essen collections, and can be typed
  in by hand.
- Geeklist games are added by **swiping**; the collection groups games by mark, unmarked first,
  "Not interested" collapsed at the bottom.
- **Unsure** joined the marks; **Not interested** is its own mark (left swipe), distinct from Poop.
- **Bought** is independent of the mark, records the price paid and adds up the money spent.
- **Search** is visible but switched off until Release 1.0.
- The big **+** opens a choice: collection, geeklist or game.
