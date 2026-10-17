import { type AuthEnv, type Authenticate, createAuthenticator } from './auth.ts'
import { BggError, edgeCache, memoryCache } from './bgg/cache.ts'
import { GeekdoSource } from './bgg/geekdo.ts'
import type { BggSource } from './bgg/source.ts'
import { type Db, connect } from './db/db.ts'
import { HttpError, errorResponse } from './http.ts'
import { companiesRoute } from './routes/companies.ts'
import type { RouteContext } from './routes/context.ts'
import { gamesRoute } from './routes/games.ts'
import { listsRoute } from './routes/lists.ts'
import { getSync, postSync } from './routes/sync.ts'

/** The two Workers-only shapes the Worker uses (kept local so app and Worker share one type program). */
type HyperdriveBinding = { connectionString: string }
type ExecutionContext = { waitUntil(promise: Promise<unknown>): void }

export type Env = AuthEnv & {
  HYPERDRIVE?: HyperdriveBinding
  DATABASE_URL?: string
  BGG_TOKEN?: string
}

export type Deps = {
  authenticate: Authenticate
  /** The database for this request; closed by the caller when it has `close`. */
  db: (env: Env) => Db
  now: () => Date
  /** BGG data source; one per isolate in production so the 1 request/s throttle holds. */
  bgg: (env: Env) => BggSource
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
      const ctx: RouteContext = { request, url, email, db: database, bgg: deps.bgg(env), now: deps.now() }
      try {
        const listMatch = /^\/api\/bgg\/lists\/([^/]+)\/([^/]+)$/.exec(url.pathname)
        if (request.method === 'GET' && listMatch) return await listsRoute(ctx, listMatch[1] ?? '', listMatch[2] ?? '')
        const route = `${request.method} ${url.pathname}`
        switch (route) {
          case 'GET /api/bgg/games':
            return await gamesRoute(ctx)
          case 'GET /api/bgg/companies':
            return await companiesRoute(ctx)
          case 'GET /api/me':
            return Response.json({ email, bggSearch: Boolean(env.BGG_TOKEN) })
          case 'GET /api/sync':
            return await getSync(database(), email, url, deps.now())
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
let bggSource: BggSource | undefined

/** The Workers edge cache when available (not in every local runtime), else memory. */
function bggCache() {
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default
  return edge ? edgeCache(edge) : memoryCache()
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    authenticator ??= createAuthenticator(env)
    const app = createApp({
      authenticate: authenticator,
      db: e => connect(e.ENVIRONMENT === 'development' && e.DATABASE_URL ? e.DATABASE_URL : (e.HYPERDRIVE?.connectionString ?? '')),
      now: () => new Date(),
      bgg: () => (bggSource ??= new GeekdoSource({ fetch: (input, init) => fetch(input, init), cache: bggCache() })),
    })
    void ctx
    return app.fetch(request, env)
  },
}
