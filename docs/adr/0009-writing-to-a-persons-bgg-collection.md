# 0009. Writing to a person's own BGG collection with their own session

- **Status**: Accepted
- **Date**: 2026-11-08
- **Origin**: `specs/008-bgg-collection-status/research.md` R2–R5, R9; constitution Principle V

## Context

People want to change their BoardGameGeek collection statuses (Own, Wishlist, …) and record what
they paid right where they decide, in the app. BoardGameGeek's official XML API is read-only and
identifies the app, not a person; there is no OAuth. The only way to write is BoardGameGeek's own
website, signed in as the person, as other community tools do. Constitution V allows the website's
data only for reading, under a time-limited exception that excludes login sessions, and says
nothing about writing. Every person's identity in the app comes from Cloudflare Access (ADR 0003);
the app holds no passwords today.

## Decision

We let the Worker write to **the signed-in person's own BGG collection** through BoardGameGeek's
website, using **that person's own BGG session**:

- **Sign-in**: the person enters BGG username and password in Config; the Worker forwards them once
  to BGG's login and keeps neither. BGG's session cookies go back to the browser as one
  **HttpOnly, Secure, SameSite=Strict cookie** on the app's origin (path `/api/bgg/account`),
  **encrypted with AES-GCM** under the Worker secret `BGG_SESSION_KEY` and bound to the person's app
  email and BGG username. It lives only on that device, at most 30 days.
- **Writes**: only on an explicit tap (one save = at most one read of the item and one write);
  only statuses and four private info fields (price paid, currency, acquisition date, acquired
  from); never deletions, never bulk or background writes; the same 1 request/s throttle as all BGG
  access; no caching.
- **Confinement**: the website endpoints live in one adapter, `worker/bgg/account.ts`; the app's
  official API token is sent only to `/xmlapi*` paths and never together with a person's cookies.
- **No traces**: the server never stores, caches or logs passwords, sessions or cookie values;
  errors are logged as status codes only.
- **Reading** statuses stays on the official API with the app's token (ADR 0007).

The constitution gets a matching rule under Principle V (amendment 1.4.0) when this ADR is accepted.

## Consequences

- People change BGG from the app; the server never becomes a store of BGG credentials.
- The endpoints are undocumented and may change: the adapter is tested against recorded traffic and
  fails visibly ("BoardGameGeek did not take the change"), never silently.
- A new Worker secret (`BGG_SESSION_KEY`); rotating it signs everyone out of BGG.
- Each device signs in on its own; sessions expire and need a new sign-in.
- Later features that write to BGG (e.g. selling: For trade, no longer owned) use the same adapter
  and rules.

## Alternatives considered

- **Link to BGG's edit page only**: safe, but the person has to switch apps for every change; the
  owner rejected it.
- **Session in `localStorage` or IndexedDB**: any script on the origin can read it; the HttpOnly
  cookie keeps the same "this device only" promise with less exposure.
- **Session in the database**: would sync it across devices and make the server hold other people's
  BGG sessions.
- **Storing the password to sign in again**: never.
