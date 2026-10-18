/** Cache times in seconds (research R9/R10, FR-025). */
export const TTL = { list: 3600, game: 7 * 86400, company: 30 * 86400 } as const

export const USER_AGENT = 'board-a-licious/0.5 (private app for a small group of friends; SPIEL Essen planner)'
const MIN_GAP_MS = 1000
const TIMEOUT_MS = 10_000

export class BggError extends Error {
  constructor(
    readonly code: 'bgg_unavailable' | 'bgg_rate_limited' | 'not_found',
    message: string,
    readonly retryAfter?: number,
  ) {
    super(message)
  }
}

export type BggCache = {
  get(key: string): Promise<string | undefined>
  put(key: string, body: string, ttlSeconds: number): Promise<void>
}

/** In-memory cache with expiry, for tests and as a per-isolate fallback. */
export function memoryCache(now: () => number = Date.now): BggCache {
  const items = new Map<string, { body: string; expires: number }>()
  return {
    async get(key) {
      const item = items.get(key)
      if (!item) return undefined
      if (item.expires <= now()) {
        items.delete(key)
        return undefined
      }
      return item.body
    },
    async put(key, body, ttlSeconds) {
      items.set(key, { body, expires: now() + ttlSeconds * 1000 })
    },
  }
}

/** The Workers Cache API at the edge (constitution V: responses cached). */
export function edgeCache(cache: Cache): BggCache {
  const keyOf = (key: string) => new Request(`https://bgg-cache.internal/${encodeURIComponent(key)}`)
  return {
    async get(key) {
      const hit = await cache.match(keyOf(key))
      return hit ? await hit.text() : undefined
    },
    async put(key, body, ttlSeconds) {
      await cache.put(keyOf(key), new Response(body, { headers: { 'Cache-Control': `max-age=${ttlSeconds}` } }))
    },
  }
}

export type BggClient = { getJson<T = unknown>(url: string, ttlSeconds: number): Promise<T> }

/**
 * Every BGG request goes through here: answered from the cache when possible, otherwise sent with an
 * honest User-Agent, at most one per second (per Worker isolate), with errors mapped to API codes.
 */
export function createBggClient(deps: {
  fetch: typeof fetch
  cache: BggCache
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}): BggClient {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))
  let lastStart = -Infinity
  let queue: Promise<unknown> = Promise.resolve()

  const throttled = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(async () => {
      const wait = lastStart + MIN_GAP_MS - now()
      if (wait > 0) await sleep(wait)
      lastStart = now()
      return task()
    })
    queue = run.catch(() => undefined)
    return run
  }

  return {
    async getJson<T>(url: string, ttlSeconds: number): Promise<T> {
      const cached = await deps.cache.get(url)
      if (cached !== undefined) return JSON.parse(cached) as T

      const body = await throttled(async () => {
        let res: Response
        try {
          res = await deps.fetch(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          })
        } catch {
          throw new BggError('bgg_unavailable', 'BoardGameGeek is not reachable.')
        }
        if (res.status === 404) throw new BggError('not_found', 'BoardGameGeek has no such page.')
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get('Retry-After'))
          throw new BggError('bgg_rate_limited', 'BoardGameGeek asks to slow down.', Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60)
        }
        if (!res.ok) throw new BggError('bgg_unavailable', `BoardGameGeek answered ${res.status}.`)
        const text = await res.text()
        try {
          JSON.parse(text)
        } catch {
          throw new BggError('bgg_unavailable', 'BoardGameGeek sent something unexpected.')
        }
        return text
      })
      await deps.cache.put(url, body, ttlSeconds)
      return JSON.parse(body) as T
    },
  }
}
