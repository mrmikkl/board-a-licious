import type { BggCache } from '../bgg/cache.ts'
import { createSlots } from '../throttle.ts'

export const PRICES_USER_AGENT = 'board-a-licious/1.0 (private app for a small group of friends; board game price comparison)'
const MIN_GAP_MS = 1000
const TIMEOUT_MS = 8000

/** A price source did not answer usefully; the route names it as failed (FR-008). */
export class PriceSourceError extends Error {}

export type PriceHttp = {
  getText(url: string, ttlSeconds: number): Promise<string>
  getJson<T = unknown>(url: string, ttlSeconds: number): Promise<T>
}

/**
 * F007 (ADR 0008): every request to a price source: from the cache when possible (keyed by URL), with an
 * honest User-Agent, at most one per second per host, and at most `timeoutMs` (8 s) long.
 */
export function createPriceHttp(deps: {
  fetch: typeof fetch
  cache: BggCache
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  timeoutMs?: number
}): PriceHttp {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS
  const hosts = new Map<string, () => Promise<void>>()
  const slotFor = (url: string) => {
    const host = new URL(url).host
    let wait = hosts.get(host)
    if (!wait) hosts.set(host, (wait = createSlots(MIN_GAP_MS, now, sleep)))
    return wait
  }

  const load = async (url: string): Promise<string> => {
    await slotFor(url)()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PriceSourceError(`No answer from ${new URL(url).host} in time.`)), timeoutMs)
    })
    try {
      const res = await Promise.race([deps.fetch(url, { headers: { 'User-Agent': PRICES_USER_AGENT } }), timeout])
      if (!res.ok) throw new PriceSourceError(`${new URL(url).host} answered ${res.status}.`)
      return await Promise.race([res.text(), timeout])
    } catch (error) {
      throw error instanceof PriceSourceError ? error : new PriceSourceError(`${new URL(url).host} is not reachable.`)
    } finally {
      clearTimeout(timer)
    }
  }

  const getText = async (url: string, ttlSeconds: number, valid: (text: string) => boolean = () => true) => {
    const cached = await deps.cache.get(url)
    if (cached !== undefined) return cached
    const body = await load(url)
    if (!valid(body)) throw new PriceSourceError(`${new URL(url).host} sent something unexpected.`)
    await deps.cache.put(url, body, ttlSeconds)
    return body
  }
  const isJson = (text: string) => {
    try {
      JSON.parse(text)
      return true
    } catch {
      return false
    }
  }

  return {
    getText: (url, ttl) => getText(url, ttl),
    getJson: async <T>(url: string, ttl: number) => JSON.parse(await getText(url, ttl, isJson)) as T,
  }
}
