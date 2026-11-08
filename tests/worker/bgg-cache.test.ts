import { describe, expect, it } from 'vitest'

import { BggError, TTL, createBggClient, memoryCache } from '../../worker/bgg/cache.ts'

/**
 * A fake clock: sleepers wake in the order of their wake-up times (1/1000 of the real time), each with
 * time moved on to its own wake-up time, so concurrent requests see the times the client booked.
 */
function clock(start = 0) {
  let t = start
  return {
    now: () => t,
    sleep: (ms: number) => {
      const wake = t + ms
      return new Promise<void>(resolve =>
        setTimeout(() => {
          t = Math.max(t, wake)
          resolve()
        }, ms / 1000),
      )
    },
    advance: (ms: number) => void (t += ms),
  }
}

function fakeFetch(respond: (url: string) => Response | Promise<Response> = () => Response.json({ ok: true })) {
  const calls: { url: string; at: number; userAgent: string | null; authorization: string | null }[] = []
  return {
    calls,
    bind(c: ReturnType<typeof clock>) {
      return async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        const headers = new Headers(init?.headers)
        calls.push({ url, at: c.now(), userAgent: headers.get('User-Agent'), authorization: headers.get('Authorization') })
        return respond(url)
      }
    },
  }
}

function setup(respond?: (url: string) => Response | Promise<Response>, token?: string) {
  const c = clock(1_000_000)
  const f = fakeFetch(respond)
  const logs: string[] = []
  const client = createBggClient({ fetch: f.bind(c), cache: memoryCache(c.now), now: c.now, sleep: c.sleep, token, log: line => logs.push(line) })
  return { c, f, client, logs }
}

const TOKEN = 'test-token-not-real'
const xml = (body: string, status = 200) => () => new Response(body, { status, headers: { 'Content-Type': 'text/xml' } })
const THING = 'https://boardgamegeek.com/xmlapi2/thing?id=1&stats=1'

describe('BGG client', () => {
  it('has the cache times of research R9/R10: lists 1 h, games 7 days, companies 30 days', () => {
    expect(TTL).toEqual({ list: 3600, game: 7 * 86400, company: 30 * 86400, search: 86400, collection: 900 })
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

  it('a request that never finishes (cancelled with its Worker request) does not hold up later ones', async () => {
    const { f, client } = setup(url => (url.endsWith('/stuck') ? new Promise<Response>(() => {}) : Response.json({ ok: true })))
    void client.getJson('https://api.geekdo.com/stuck', TTL.game)
    await expect(client.getJson('https://api.geekdo.com/next', TTL.game)).resolves.toEqual({ ok: true })
    expect(f.calls.map(c => c.url)).toEqual(['https://api.geekdo.com/stuck', 'https://api.geekdo.com/next'])
    expect(f.calls[1]!.at - f.calls[0]!.at).toBeGreaterThanOrEqual(1000)
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

  it('fresh skips the cache for one call and stores the new answer', async () => {
    let n = 0
    const { f, client } = setup(() => Response.json({ n: ++n }))
    expect(await client.getJson('https://api.geekdo.com/a', TTL.list)).toEqual({ n: 1 })
    expect(await client.getJson('https://api.geekdo.com/a', TTL.list, { fresh: true })).toEqual({ n: 2 })
    expect(await client.getJson('https://api.geekdo.com/a', TTL.list)).toEqual({ n: 2 })
    expect(f.calls).toHaveLength(2)
  })

  it('does not cache failures', async () => {
    let fail = true
    const { f, client } = setup(() => (fail ? new Response('', { status: 500 }) : Response.json({ ok: 1 })))
    await expect(client.getJson('https://api.geekdo.com/a', TTL.game)).rejects.toBeInstanceOf(BggError)
    fail = false
    expect(await client.getJson('https://api.geekdo.com/a', TTL.game)).toEqual({ ok: 1 })
    expect(f.calls).toHaveLength(2)
  })

  describe('official XML API (F006 research R1, R6, R7)', () => {
    it('sends the token as a Bearer header to boardgamegeek.com only, never in the URL', async () => {
      const { f, client } = setup(xml('<items/>'), TOKEN)
      await client.getXml(THING, TTL.game)
      await client.getJson('https://api.geekdo.com/api/geekpreviews/93', TTL.list).catch(() => undefined)
      expect(f.calls[0]?.authorization).toBe(`Bearer ${TOKEN}`)
      expect(f.calls[0]?.userAgent).toMatch(/^board-a-licious\//)
      expect(f.calls[0]?.url).not.toContain(TOKEN)
      expect(f.calls[1]?.authorization).toBeNull()
    })

    it('sends the token only to /xmlapi and /xmlapi2 paths on boardgamegeek.com (F008 research R5)', async () => {
      const { f, client } = setup(xml('<items/>'), TOKEN)
      const urls = [
        'https://boardgamegeek.com/xmlapi/geeklist/1',
        'https://boardgamegeek.com/xmlapi2/collection?username=anna',
        'https://boardgamegeek.com/geekcollection.php?ajax=1',
        'https://boardgamegeek.com/api/collectionitems',
        'https://boardgamegeek.com/xmlapifake',
        'https://boardgamegeek.com.evil.example/xmlapi2/thing?id=1',
        'https://www.boardgamegeek.com/xmlapi2/thing?id=1',
      ]
      for (const url of urls) await client.getXml(url, TTL.game)
      expect(f.calls.map(c => c.authorization)).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`, null, null, null, null, null])
    })

    it('answers bgg_preparing instead of bgg_rate_limited when asked to (collections)', async () => {
      const { client } = setup(() => new Response('<message>accepted</message>', { status: 202 }), TOKEN)
      const error = await client.getXml('https://boardgamegeek.com/xmlapi2/collection?username=a', TTL.collection, { preparing: true }).catch((e: BggError) => e)
      expect(error).toMatchObject({ code: 'bgg_preparing', retryAfter: 5 })
    })

    it('sends no Authorization header without a token', async () => {
      const { f, client } = setup(xml('<items/>'))
      await client.getXml(THING, TTL.game)
      expect(f.calls[0]?.authorization).toBeNull()
    })

    it('caches XML by URL like JSON', async () => {
      const { f, client } = setup(xml('<items><item id="1"/></items>'), TOKEN)
      expect(await client.getXml(THING, TTL.game)).toBe(await client.getXml(THING, TTL.game))
      expect(f.calls).toHaveLength(1)
    })

    it('retries a queued 202 up to 3 times, 2 s apart, then asks to wait 5 s', async () => {
      let n = 0
      const { f, client } = setup(() => (++n <= 2 ? new Response('<message>accepted</message>', { status: 202 }) : new Response('<geeklist/>')), TOKEN)
      expect(await client.getXml('https://boardgamegeek.com/xmlapi/geeklist/1', TTL.list)).toBe('<geeklist/>')
      expect(f.calls).toHaveLength(3)
      expect(f.calls[2]!.at - f.calls[1]!.at).toBeGreaterThanOrEqual(2000)

      const stuck = setup(() => new Response('<message>accepted</message>', { status: 202 }), TOKEN)
      const error = await stuck.client.getXml('https://boardgamegeek.com/xmlapi/geeklist/2', TTL.list).catch((e: BggError) => e)
      expect(stuck.f.calls).toHaveLength(4)
      expect(error).toMatchObject({ code: 'bgg_rate_limited', retryAfter: 5 })
    })

    it('reports a rejected token as not reachable and logs the status without the token', async () => {
      for (const status of [401, 403]) {
        const { client, logs } = setup(xml('Unauthorized', status), TOKEN)
        const error = (await client.getXml(THING, TTL.game).catch((e: BggError) => e)) as BggError
        expect(error).toMatchObject({ code: 'bgg_unavailable', message: 'BoardGameGeek is not reachable.' })
        expect(error.message).not.toContain(TOKEN)
        expect(logs).toEqual([`bgg token rejected ${status}`])
      }
    })

    it('maps malformed XML to bgg_unavailable', async () => {
      const { client } = setup(xml('{"json": true}'), TOKEN)
      await expect(client.getXml(THING, TTL.game)).rejects.toMatchObject({ code: 'bgg_unavailable' })
    })
  })
})
