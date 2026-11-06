import { memoryCache } from '../../worker/bgg/cache.ts'
import { createBggSource } from '../../worker/bgg/routing.ts'
import type { BggSource } from '../../worker/bgg/source.ts'
import type { Db } from '../../worker/db/db.ts'
import { type PriceHttp, createPriceHttp } from '../../worker/prices/http.ts'
import { createApp } from '../../worker/index.ts'

export const ANNA = 'anna@example.com'

export type FakeBgg = (url: URL) => Response | Promise<Response>

/** The Worker app with a fixed signed-in user, a test database, a fixed clock and a fake BGG. */
export function testApp(
  db: Db,
  options: { email?: string | null; now?: string; bgg?: FakeBgg; bggCalls?: string[]; fullCalls?: boolean; env?: Record<string, string> } = {},
) {
  const now = () => new Date(options.now ?? '2026-10-17T12:00:00.000Z')
  const bggFetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    options.bggCalls?.push(options.fullCalls ? url.href : `${url.pathname}${url.search}`)
    if (!options.bgg) throw new Error(`unexpected BGG call ${url}`)
    return options.bgg(url)
  }
  let source: BggSource | undefined
  let prices: PriceHttp | undefined
  const app = createApp({
    authenticate: async () => (options.email === undefined ? ANNA : options.email),
    db: () => db,
    now,
    bgg: env =>
      (source ??= createBggSource({
        fetch: bggFetch,
        cache: memoryCache(() => now().getTime()),
        now: () => now().getTime(),
        sleep: async () => {},
        token: env.BGG_TOKEN || undefined,
        log: () => {},
      })),
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
