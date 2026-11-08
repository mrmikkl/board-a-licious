import { memoryCache } from '../../worker/bgg/cache.ts'
import type { BggAccount } from '../../worker/bgg/account.ts'
import { createBgg } from '../../worker/bgg/routing.ts'
import type { BggSource } from '../../worker/bgg/source.ts'
import type { Db } from '../../worker/db/db.ts'
import { type PriceHttp, createPriceHttp } from '../../worker/prices/http.ts'
import { type Env, createApp } from '../../worker/index.ts'

export const ANNA = 'anna@example.com'

/** A fake BGG; `init` holds method, headers and body (F008 website requests). */
export type FakeBgg = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** The Worker app with a fixed signed-in user, a test database, a fixed clock and a fake BGG. */
export function testApp(
  db: Db,
  options: { email?: string | null; now?: string; bgg?: FakeBgg; bggCalls?: string[]; fullCalls?: boolean; env?: Record<string, string> } = {},
) {
  const now = () => new Date(options.now ?? '2026-10-17T12:00:00.000Z')
  const bggFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    options.bggCalls?.push(options.fullCalls ? url.href : `${url.pathname}${url.search}`)
    if (!options.bgg) throw new Error(`unexpected BGG call ${url}`)
    return options.bgg(url, init)
  }
  // one client for both, so data reads and account writes share the 1 request/s slot
  let bgg: { source: BggSource; account: BggAccount } | undefined
  const bggOf = (env: Env) =>
    (bgg ??= createBgg({
      fetch: bggFetch,
      cache: memoryCache(() => now().getTime()),
      now: () => now().getTime(),
      sleep: async () => {},
      token: env.BGG_TOKEN || undefined,
      log: () => {},
    }))
  let prices: PriceHttp | undefined
  const app = createApp({
    authenticate: async () => (options.email === undefined ? ANNA : options.email),
    db: () => db,
    now,
    bgg: env => bggOf(env).source,
    bggAccount: env => bggOf(env).account,
    // F007: price sources go through the same fake (by host)
    prices: () => (prices ??= createPriceHttp({ fetch: bggFetch, cache: memoryCache(() => now().getTime()), now: () => now().getTime(), sleep: async () => {} })),
  })
  return (path: string, init?: RequestInit) =>
    app.fetch(new Request(`https://app.example${path}`, init), { ENVIRONMENT: 'production', ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '', ...options.env })
}

export const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/** A recorded BGG response from tests/fixtures/bgg/. */
export async function fixture(name: string): Promise<Response> {
  const { readFile } = await import('node:fs/promises')
  return new Response(await readFile(new URL(`../fixtures/bgg/${name}`, import.meta.url)), {
    headers: { 'Content-Type': 'application/json' },
  })
}
