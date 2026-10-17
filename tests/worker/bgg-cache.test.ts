import { describe, expect, it } from 'vitest'

import { BggError, TTL, createBggClient, memoryCache } from '../../worker/bgg/cache.ts'

/** A fake clock: sleeping advances time instantly. */
function clock(start = 0) {
  let t = start
  return { now: () => t, sleep: async (ms: number) => void (t += ms), advance: (ms: number) => void (t += ms) }
}

function fakeFetch(respond: (url: string) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const calls: { url: string; at: number; userAgent: string | null }[] = []
  return {
    calls,
    bind(c: ReturnType<typeof clock>) {
      return async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        calls.push({ url, at: c.now(), userAgent: new Headers(init?.headers).get('User-Agent') })
        return respond(url)
      }
    },
  }
}

function setup(respond?: (url: string) => Response | Promise<Response>) {
  const c = clock(1_000_000)
  const f = fakeFetch(respond)
  const client = createBggClient({ fetch: f.bind(c), cache: memoryCache(c.now), now: c.now, sleep: c.sleep })
  return { c, f, client }
}

describe('BGG client', () => {
  it('has the cache times of research R9/R10: lists 1 h, games 7 days, companies 30 days', () => {
    expect(TTL).toEqual({ list: 3600, game: 7 * 86400, company: 30 * 86400 })
  })

  it('serves a repeated request from the cache until it expires', async () => {
    const { c, f, client } = setup()
    await client.getJson('https://api.geekdo.com/a', TTL.list)
    await client.getJson('https://api.geekdo.com/a', TTL.list)
    expect(f.calls).toHaveLength(1)
    c.advance(3601_000)
    await client.getJson('https://api.geekdo.com/a', TTL.list)
    expect(f.calls).toHaveLength(2)
  })

  it('sends at most one request per second to BGG', async () => {
    const { f, client } = setup()
    await Promise.all(['a', 'b', 'c'].map(p => client.getJson(`https://api.geekdo.com/${p}`, TTL.game)))
    const gaps = f.calls.slice(1).map((call, i) => call.at - (f.calls[i]?.at ?? 0))
    expect(gaps.every(gap => gap >= 1000)).toBe(true)
  })

  it('identifies the app honestly', async () => {
    const { f, client } = setup()
    await client.getJson('https://api.geekdo.com/a', TTL.game)
    expect(f.calls[0]?.userAgent).toMatch(/^board-a-licious\/\S+ \(.+\)$/)
  })

  it('maps failures to bgg_unavailable, 429 to bgg_rate_limited and 404 to not_found', async () => {
    const statusOf = async (respond: () => Response | Promise<Response>) => {
      const { client } = setup(respond)
      return client.getJson('https://api.geekdo.com/x', TTL.game).then(
        () => 'ok',
        (error: BggError) => [error.code, error.retryAfter],
      )
    }
    expect(await statusOf(() => new Response('', { status: 500 }))).toEqual(['bgg_unavailable', undefined])
    expect(await statusOf(() => Promise.reject(new TypeError('network')))).toEqual(['bgg_unavailable', undefined])
    expect(await statusOf(() => new Response('', { status: 429, headers: { 'Retry-After': '30' } }))).toEqual([
      'bgg_rate_limited',
      30,
    ])
    expect(await statusOf(() => new Response('', { status: 404 }))).toEqual(['not_found', undefined])
    expect(await statusOf(() => new Response('<html>', { status: 200 }))).toEqual(['bgg_unavailable', undefined])
  })

  it('does not cache failures', async () => {
    let fail = true
    const { f, client } = setup(() => (fail ? new Response('', { status: 500 }) : Response.json({ ok: 1 })))
    await expect(client.getJson('https://api.geekdo.com/a', TTL.game)).rejects.toBeInstanceOf(BggError)
    fail = false
    expect(await client.getJson('https://api.geekdo.com/a', TTL.game)).toEqual({ ok: 1 })
    expect(f.calls).toHaveLength(2)
  })
})
