import { type AuthEnv, type Authenticate, createAuthenticator } from './auth.ts'
import { BggError, edgeCache, memoryCache } from './bgg/cache.ts'
import type { BggAccount } from './bgg/account.ts'
import { createBgg } from './bgg/routing.ts'
import type { BggSource } from './bgg/source.ts'
import { type Db, connect } from './db/db.ts'
import { HttpError, errorResponse } from './http.ts'
import { type PriceHttp, createPriceHttp } from './prices/http.ts'
import { type AccountContext, accountRoute, saveRoute, signInRoute, signOutRoute } from './routes/account.ts'
import { collectionRoute } from './routes/collection.ts'
import { companiesRoute } from './routes/companies.ts'
import type { RouteContext } from './routes/context.ts'
import { gamesRoute } from './routes/games.ts'
import { imagesRoute } from './routes/images.ts'
import { listsRoute } from './routes/lists.ts'
import { pricesRoute } from './routes/prices.ts'
import { searchRoute } from './routes/search.ts'
import { getSync, postSync } from './routes/sync.ts'

/** The two Workers-only shapes the Worker uses (kept local so app and Worker share one type program). */
type HyperdriveBinding = { connectionString: string }
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void }

export type Env = AuthEnv & {
  HYPERDRIVE?: HyperdriveBinding
  DATABASE_URL?: string
  BGG_TOKEN?: string
  /** F008 (ADR 0009): 32 bytes, base64; encrypts the person's BGG session cookie. */
  BGG_SESSION_KEY?: string
}

export type Deps = {
  authenticate: Authenticate
  /** The database for this request; closed by the caller when it has `close`. */
  db: (env: Env) => Db
  now: () => Date
  /** BGG data source; one per isolate in production so the 1 request/s throttle holds. */
  bgg: (env: Env) => BggSource
  /** F008 (ADR 0009): writes to the signed-in person's own BGG collection; shares the BGG throttle. */
  bggAccount: (env: Env) => BggAccount
  /** F007: fetch for the price sources; one per isolate so the per-host throttle holds. */
  prices: (env: Env) => PriceHttp
}

/** The Worker as a plain object, so tests can inject sign-in, database and clock. */
export function createApp(deps: Deps) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url)
      if (!url.pathname.startsWith('/api/')) return errorResponse('not_found', 'No such API route.')
      const email = await deps.authenticate(request)
      if (!email) return errorResponse('unauthenticated', 'Sign in to use the app.')

      let db: Db | undefined
      const database = () => (db ??= deps.db(env))
      const ctx: RouteContext = { request, url, email, db: database, bgg: deps.bgg(env), prices: deps.prices(env), now: deps.now() }
      // F008: never log bodies or cookies of these routes (research R4)
      const account = (): AccountContext => ({ ...ctx, account: deps.bggAccount(env), key: env.BGG_SESSION_KEY })
      try {
        const listMatch = /^\/api\/bgg\/lists\/([^/]+)\/([^/]+)$/.exec(url.pathname)
        if (request.method === 'GET' && listMatch) return await listsRoute(ctx, listMatch[1] ?? '', listMatch[2] ?? '')
        const saveMatch = /^\/api\/bgg\/account\/collection\/([^/]+)$/.exec(url.pathname)
        if (request.method === 'POST' && saveMatch) return await saveRoute(account(), saveMatch[1] ?? '')
        const route = `${request.method} ${url.pathname}`
        switch (route) {
          case 'GET /api/bgg/games':
            return await gamesRoute(ctx)
          case 'GET /api/prices':
            return await pricesRoute(ctx)
          case 'GET /api/bgg/search':
            return await searchRoute(ctx)
          case 'GET /api/bgg/images':
            return await imagesRoute(ctx)
          case 'GET /api/bgg/collection':
            return await collectionRoute(ctx)
          case 'GET /api/bgg/account':
            return await accountRoute(account())
          case 'POST /api/bgg/account/signin':
            return await signInRoute(account())
          case 'POST /api/bgg/account/signout':
            return await signOutRoute()
          case 'GET /api/bgg/companies':
            return await companiesRoute(ctx)
          case 'GET /api/signin':
            // reached only through Access, so the person has just signed in: back to the app
            return new Response(null, { status: 302, headers: { Location: '/' } })
          case 'GET /api/me':
            return Response.json({ email, bggSearch: Boolean(env.BGG_TOKEN) })
          case 'GET /api/sync':
            return await getSync(database(), email, url)
          case 'POST /api/sync':
            return await postSync(database(), email, request, deps.now())
          default:
            return errorResponse('not_found', 'No such API route.')
        }
      } catch (error) {
        if (error instanceof HttpError) return errorResponse(error.code, error.message)
        if (error instanceof BggError) {
          return errorResponse(error.code, error.message, error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined)
        }
        console.error(error)
        return Response.json({ error: 'internal', message: 'Something went wrong on the server.', retryable: true }, { status: 500 })
      } finally {
        const closable = db as (Db & { close?: () => Promise<void> }) | undefined
        await closable?.close?.()
      }
    },
  }
}

let authenticator: Authenticate | undefined
let bgg: { source: BggSource; account: BggAccount } | undefined
let priceHttp: PriceHttp | undefined

/** The Workers edge cache when available (not in every local runtime), else memory. */
function bggCache() {
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default
  return edge ? edgeCache(edge) : memoryCache()
}

/** One BGG client per isolate for data and account writes, so the 1 request/s throttle holds for both. */
const bggOf = (env: Env) =>
  (bgg ??= createBgg({ fetch: (input, init) => fetch(input, init), cache: bggCache(), token: env.BGG_TOKEN || undefined }))

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    authenticator ??= createAuthenticator(env)
    const app = createApp({
      authenticate: authenticator,
      db: e => connect(e.ENVIRONMENT === 'development' && e.DATABASE_URL ? e.DATABASE_URL : (e.HYPERDRIVE?.connectionString ?? '')),
      now: () => new Date(),
      // one source (and one throttled client) per isolate; the token is a deployment secret, the same for every request
      prices: () => (priceHttp ??= createPriceHttp({ fetch: (input, init) => fetch(input, init), cache: bggCache() })),
      bgg: e => bggOf(e).source,
      bggAccount: e => bggOf(e).account,
    })
    void ctx
    return app.fetch(request, env)
  },
}
