# Setup: Neon and Cloudflare

How production was set up, step by step, and how to change it later. What each part does:
[hosting.md](hosting.md). Commands run from the repository root.

## Before you start

- A Cloudflare account (dash.cloudflare.com/sign-up, free; **not** the "Cloudflare Connect"
  conference registration) and a Neon account (neon.tech, free).
- `npm install`, then once `npx wrangler login` (opens the browser; click **Allow**).
- **Connection strings contain the database password.** Use them only in your own terminal;
  never paste them into chats, issues or commits. If one leaks, see "Neon password" below.

## 1. workers.dev subdomain (once per Cloudflare account)

The app's address is `<worker>.<subdomain>.workers.dev`. Choose the subdomain in the dashboard:
Workers & Pages → (first visit asks) or the overview's right sidebar → **Subdomain** → Change.
Here: `boardgamegeek`, so the app lives at `https://board-a-licious.boardgamegeek.workers.dev`.
Changing it later changes every link you have shared.

## 2. Neon database

1. Create a project: name `Board-a-licious`, **Region** dropdown → **AWS Europe Central 1
   (Frankfurt)** (next to Essen). Services: only **Postgres database**; leave Object storage,
   Functions, AI gateway, Realtime and Neon Auth off (sign-in is Cloudflare Access).
2. Skip the "Let your coding agent set it up" page; go to the project dashboard.
3. **Connect** → turn **Connection pooling off** (Hyperdrive pools itself) → copy the string.
   Make sure the host has **no `-pooler`** and remove `&channel_binding=require` at the end:
   ```text
   postgresql://neondb_owner:<password>@ep-….c-8.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Create the tables:
   ```bash
   cp .env.neon.example .env.neon   # then paste the direct string into .env.neon (git-ignored)
   npm run db:migrate:neon          # prints: applied 0001_collections.sql …
   ```
   The statements are idempotent; running it again is safe. Later schema changes are new files
   in `migrations/`, applied the same way. `.env.neon` holds the password: it never goes into git
   or a chat, and `.claude/settings.json` denies Claude Code reading it.

## 3. Hyperdrive

```bash
npx wrangler hyperdrive create board-a-licious-db --connection-string='<direct string>'
```

Answer **n** when wrangler offers to edit the config, and put the printed ID into
`wrangler.jsonc` → `hyperdrive[0].id` yourself (that keeps the `localConnectionString` for local
development). Here: `fe856b6ea9814a788872db3a9ff9ef89`.

## 4. First deploy

```bash
npm run deploy      # tsc, vite build, wrangler deploy
```

Until Access is on (next steps), the pages are reachable but every `/api` call answers
`401 unauthenticated`, so no data can leak.

## 5. Zero Trust (once per account)

1. Dashboard sidebar → **Zero Trust** (also called *Cloudflare One*) → **Get started**.
2. **Team name**: e.g. `boardalicious` → login page `boardalicious.cloudflareaccess.com`.
   A random name (like `morning-cloud-345d`) can be changed under Zero Trust → **Settings** →
   Team domain → Edit.
3. Plan: **Zero Trust Free** ($0 per seat per month, up to 50 seats) → **Select plan**.
   Cloudflare asks for a payment method as a check; the summary must show **$0.00**. Nothing is
   charged unless you pick a paid plan or add-on.

## 6. Access for the Worker

Access applications of type "self-hosted" cannot be created for `workers.dev` addresses; switch
it on from the Worker instead:

1. Workers & Pages → `board-a-licious` → tab **Access** → protect the Worker.
2. **Scope: All traffic** (not "Previews only", which leaves the real address open).
3. **Authentication policy** → pick **Cloudflare account** for now (only you).
   Do **not** pick "Email domain": with `web.de` everyone with a web.de address could sign in.
4. **Apply Access**. The address now redirects to the PIN login.

Then refine it in Zero Trust → **Access controls → Applications** → the Worker's application
(`board-a-licious - Cloudflare Workers`):

5. **Policies** → **Create new policy**: name `Friends`, action **Allow**, rule **Include →
   Selector: Emails → Value**: one address per entry (yours and your friends'). Policy session
   duration: "Same as application session duration". Leave MFA, purpose justification and
   temporary authentication **off** (they only add hurdles). **Save policy**, then **Save**.
   Use only *Include* (OR); *Require* (AND) would demand every rule at once.
6. **Login methods**: "Select all" (= One-time PIN) is fine; switch **Apply instant
   authentication** on, so the email field comes without a provider choice. **Save**.
7. **Details**: **Session duration 1 month** (the longest), so nobody needs a PIN at the fair.
   **Save**.

## 7. Connect the app to Access

The Worker checks Access's token against two values in `wrangler.jsonc` → `vars`:

| Variable | Value | Where to find it |
|---|---|---|
| `ACCESS_TEAM_DOMAIN` | `boardalicious.cloudflareaccess.com` | Zero Trust → Settings → Team domain |
| `ACCESS_AUD` | `c59f4fd3…f018fa5` (64 hex characters) | Zero Trust → Access controls → Applications → the application → Overview / Basic information → "Application Audience (AUD) Tag"; also `kid=…` in the login redirect (`curl -sI <app url>`) |

Neither is secret. Then deploy again: `npm run deploy`.

## 8. Check it

```bash
curl -sI https://board-a-licious.boardgamegeek.workers.dev/          # 302 to …cloudflareaccess.com/…/login
curl -s  https://board-a-licious.boardgamegeek.workers.dev/api/sync  # no data without a login
```

In a browser: open the address → email → PIN from the email → the app opens (intro first on a
new device). Create a collection, then open the app in a private window or on a second device
and sign in again: the collection appears there, so the way through Hyperdrive to Neon works.

## Later changes

- **Invite someone**: Zero Trust → Access controls → Applications → the application → Policies
  → `Friends` → add the email → Save. Nothing to deploy; their collections start empty. Test
  first with **Policy tester** if you like.
- **Remove someone**: delete their email from `Friends`. Their data stays in Neon until removed.
- **Deploy a new version**: `npm run deploy` (needs `npx wrangler login` on a new machine).
- **Schema change**: new file in `migrations/`, then `npm run db:migrate:neon` before deploying
  the code that needs it.
- **Neon password** (reset if it ever leaked): Neon → Roles → `neondb_owner` → Reset password,
  then build the new direct string as in step 2, put it into `.env.neon` and update Hyperdrive:
  ```bash
  npx wrangler hyperdrive update fe856b6ea9814a788872db3a9ff9ef89 --connection-string='<new direct string>'
  ```
- **BGG token (Release 1.0)**: `npx wrangler secret put BGG_TOKEN`; the Worker then reports
  search as available.
- **Logs when something breaks**: `npx wrangler tail` shows live requests and errors; for stored
  logs switch on Workers Logs (`"observability": { "enabled": true }` in `wrangler.jsonc`).
- **Local development** needs none of this: see the commands in [CLAUDE.md](../../CLAUDE.md)
  (`npm run db:local`, `npm run dev`).
