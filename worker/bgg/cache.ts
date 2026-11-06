/** Cache times in seconds (research R9/R10, FR-025). */
export const TTL = { list: 3600, game: 7 * 86400, company: 30 * 86400, search: 86400 } as const

export const USER_AGENT = 'board-a-licious/0.5 (private app for a small group of friends; SPIEL Essen planner)'
const MIN_GAP_MS = 1000
const TIMEOUT_MS = 10_000

export class BggError extends Error {
  constructor(
    readonly code: 'bgg_unavailable' | 'bgg_rate_limited' | 'bgg_search_unavailable' | 'not_found',
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

export type BggClient = {
  getJson<T = unknown>(url: string, ttlSeconds: number): Promise<T>
  /** F006: the official XML API's answer as text (parsed by worker/bgg/xml.ts). */
  getXml(url: string, ttlSeconds: number): Promise<string>
}

/** Only the official API gets the token (research R1); the website JSON never does. */
const OFFICIAL = 'https://boardgamegeek.com/'
/** BGG answers 202 while it prepares a big geeklist (research R6). */
const QUEUED_RETRIES = 3
const QUEUED_WAIT_MS = 2000

const looksLikeJson = (text: string) => {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}
const looksLikeXml = (text: string) => /^\s*<(\?xml|[A-Za-z])/.test(text)

/**
 * Every BGG request goes through here: answered from the cache when possible, otherwise sent with an
 * honest User-Agent (and the token for the official API), at most one per second (per Worker isolate),
 * with errors mapped to API codes. The token is never put into URLs, cache keys, messages or logs.
 */
export function createBggClient(deps: {
  fetch: typeof fetch
  cache: BggCache
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  token?: string
  log?: (line: string) => void
}): BggClient {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))
  const log = deps.log ?? (line => console.error(line))
  // Each request books its own start time, at least a second after the last one booked. It never waits
  // on another request's promise: a Worker request that is cancelled (the app drops an older search)
  // leaves its promises unsettled forever, and a chained queue would then hold up every later request.
  let nextSlot = -Infinity

  const send = async (url: string, accept: string): Promise<Response> => {
    const slot = Math.max(now(), nextSlot)
    nextSlot = slot + MIN_GAP_MS
    const wait = slot - now()
    if (wait > 0) await sleep(wait)
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: accept }
    const official = url.startsWith(OFFICIAL)
    if (official && deps.token) headers.Authorization = `Bearer ${deps.token}`
    try {
      return await deps.fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch {
      throw new BggError('bgg_unavailable', 'BoardGameGeek is not reachable.')
    }
  }

  const getText = async (url: string, ttlSeconds: number, accept: string, valid: (text: string) => boolean): Promise<string> => {
    const cached = await deps.cache.get(url)
    if (cached !== undefined) return cached

    const body = await (async () => {
      let res = await send(url, accept)
      for (let retry = 0; res.status === 202 && retry < QUEUED_RETRIES; retry++) {
        await sleep(QUEUED_WAIT_MS)
        res = await send(url, accept)
      }
      if (res.status === 202) throw new BggError('bgg_rate_limited', 'BoardGameGeek is preparing this list.', 5)
      if ((res.status === 401 || res.status === 403) && url.startsWith(OFFICIAL) && deps.token) {
        log(`bgg token rejected ${res.status}`)
        throw new BggError('bgg_unavailable', 'BoardGameGeek is not reachable.')
      }
      if (res.status === 404) throw new BggError('not_found', 'BoardGameGeek has no such page.')
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        throw new BggError('bgg_rate_limited', 'BoardGameGeek asks to slow down.', Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60)
      }
      if (!res.ok) throw new BggError('bgg_unavailable', `BoardGameGeek answered ${res.status}.`)
      const text = await res.text()
      if (!valid(text)) throw new BggError('bgg_unavailable', 'BoardGameGeek sent something unexpected.')
      return text
    })()
    await deps.cache.put(url, body, ttlSeconds)
    return body
  }

  return {
    async getJson<T>(url: string, ttlSeconds: number): Promise<T> {
      return JSON.parse(await getText(url, ttlSeconds, 'application/json', looksLikeJson)) as T
    },
    getXml(url: string, ttlSeconds: number): Promise<string> {
      return getText(url, ttlSeconds, 'application/xml, text/xml', looksLikeXml)
    },
  }
}
