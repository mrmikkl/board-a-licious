import { describe, expect, it } from 'vitest'

import { memoryCache } from '../../worker/bgg/cache.ts'
import { PriceSourceError, createPriceHttp } from '../../worker/prices/http.ts'

function setup(respond: (url: string) => Response | Promise<Response>) {
  let t = 1_000_000
  const calls: { url: string; at: number; ua: string | null }[] = []
  const http = createPriceHttp({
    fetch: async (input, init) => {
      calls.push({ url: String(input), at: t, ua: new Headers(init?.headers).get('User-Agent') })
      return respond(String(input))
    },
    cache: memoryCache(() => t),
    now: () => t,
    sleep: ms =>
      new Promise<void>(resolve => {
        const wake = t + ms
        setTimeout(() => {
          t = Math.max(t, wake)
          resolve()
        }, ms / 1000)
      }),
    timeoutMs: 50,
  })
  return { http, calls, advance: (ms: number) => void (t += ms) }
}

describe('price sources: cached, throttled fetch (F007 T005)', () => {
  it('answers a repeated request from the cache until it expires', async () => {
    const { http, calls, advance } = setup(() => Response.json({ ok: 1 }))
    await http.getJson('https://brettspielpreise.de/api/info?eid=1', 3600)
    await http.getJson('https://brettspielpreise.de/api/info?eid=1', 3600)
    expect(calls).toHaveLength(1)
    advance(3601_000)
    await http.getJson('https://brettspielpreise.de/api/info?eid=1', 3600)
    expect(calls).toHaveLength(2)
  })

  it('identifies the app honestly', async () => {
    const { http, calls } = setup(() => new Response('<rss/>'))
    await http.getText('https://unknowns.de/marketplace/marketplace-feed/', 3600)
    expect(calls[0]?.ua).toMatch(/^board-a-licious\/\S+ \(.+\)$/)
  })

  it('sends at most one request per second to the same host, other hosts at once', async () => {
    const { http, calls } = setup(() => Response.json({}))
    await Promise.all([
      http.getJson('https://brettspielpreise.de/a', 60),
      http.getJson('https://brettspielpreise.de/b', 60),
      http.getJson('https://www.ecb.europa.eu/x', 60),
    ])
    const at = (end: string) => calls.find(c => c.url.endsWith(end))!.at
    expect(at('.de/b') - at('.de/a')).toBeGreaterThanOrEqual(1000)
    expect(at('/x')).toBe(at('.de/a'))
  })

  it('a request that never finishes does not hold up the next one', async () => {
    const { http } = setup(url => (url.endsWith('/stuck') ? new Promise<Response>(() => {}) : Response.json({ ok: 1 })))
    void http.getJson('https://brettspielpreise.de/stuck', 60).catch(() => {})
    await expect(http.getJson('https://brettspielpreise.de/next', 60)).resolves.toEqual({ ok: 1 })
  })

  it('maps failures, timeouts and unexpected answers to PriceSourceError', async () => {
    const fail = (respond: () => Response | Promise<Response>) => setup(respond).http.getJson('https://x.example/a', 60)
    await expect(fail(() => new Response('', { status: 500 }))).rejects.toBeInstanceOf(PriceSourceError)
    await expect(fail(() => Promise.reject(new TypeError('network')))).rejects.toBeInstanceOf(PriceSourceError)
    await expect(fail(() => new Response('<html>'))).rejects.toBeInstanceOf(PriceSourceError)
  })
})
