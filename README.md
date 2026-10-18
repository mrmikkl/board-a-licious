# Board-a-licious

A mobile-first web app for a small group of friends going to SPIEL Essen: collections of
BoardGameGeek games, marked by swiping, ticked off as bought at the fair, shared as text. Once the
app is on an Android home screen, games can be shared to it from the BGG app or website straight
into a collection.

- What and why: [docs/vision.md](docs/vision.md) · all docs: [docs/README.md](docs/README.md)
- Run it locally and test it: [quickstart](specs/001-bgg-game-collection/quickstart.md) and the
  commands in [CLAUDE.md](CLAUDE.md)

## Hosting

The app runs on Cloudflare (Worker, Hyperdrive, Access) with a Neon database, all on free plans:
what each part does is in [docs/hosting/hosting.md](docs/hosting/hosting.md), how it was set up
and how to change it (invite friends, deploy, migrations) in
[docs/hosting/setup.md](docs/hosting/setup.md).
