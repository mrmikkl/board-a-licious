# Board-a-licious

A mobile-first web app for a small group of friends going to SPIEL Essen: collections of
BoardGameGeek games, marked by swiping, ticked off as bought at the fair, shared as text.

- What and why: [docs/vision.md](docs/vision.md) · all docs: [docs/README.md](docs/README.md)
- Run it locally and test it: [quickstart](specs/001-bgg-game-collection/quickstart.md) and the
  commands in [CLAUDE.md](CLAUDE.md)

## Production setup (once)

The app runs on Cloudflare (Worker, Hyperdrive, Access) with a Neon database, all on free plans;
what each part does is in [docs/hosting.md](docs/hosting.md).

1. **Neon**: create a project in AWS Europe Central 1 (Frankfurt) with only "Postgres database";
   copy the **direct** connection string (Connect → connection pooling off; host without
   `-pooler`; drop `channel_binding=require`). Keep it out of chats and commits.
2. **Schema and Hyperdrive**, in your own terminal:
   ```bash
   DATABASE_URL='<direct string>' npm run db:migrate
   npx wrangler hyperdrive create board-a-licious-db --connection-string='<direct string>'
   ```
   Put the printed ID into `wrangler.jsonc` (`hyperdrive[0].id`).
3. **Deploy**: `npm run deploy` (needs `npx wrangler login` once).
4. **Zero Trust**: in the Cloudflare dashboard, Zero Trust → Get started → team name (here
   `boardalicious`) → plan **Zero Trust Free**.
5. **Access for the Worker**: Workers & Pages → `board-a-licious` → tab **Access** → scope
   **All traffic** → policy → Apply Access. Then in Zero Trust → Access controls → Applications →
   the Worker's application: policy "Friends" (Allow, include Emails), login method One-time PIN
   with instant authentication, session duration 1 month, Save.
6. **Configure and redeploy**: set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (Application Audience
   tag) in `wrangler.jsonc`, then `npm run deploy`.
7. **Invite** friends by adding their emails to the "Friends" policy.
