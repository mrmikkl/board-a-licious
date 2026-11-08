import { type BggAccount, createBggAccount } from './account.ts'
import { type BggCache, type BggClient, createBggClient } from './cache.ts'
import { GeekdoSource } from './geekdo.ts'
import { OfficialSource } from './official.ts'
import type { BggSource } from './source.ts'

/**
 * ADR 0007: with the token, game details, search and geeklists come from the official XML API; previews,
 * company names and galleries (not offered there) from the website JSON. Without it, the website JSON
 * serves everything; search and collections (F008) are unavailable. Both share one client, so the 1 request/s limit holds.
 */
export function createBggSource(deps: BggDeps): BggSource {
  return createBgg(deps).source
}

type BggDeps = {
  fetch: typeof fetch
  cache: BggCache
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  token?: string
  log?: (line: string) => void
}

/** The data source and the account writer (F008, ADR 0009) over one client: one throttle slot for both. */
export function createBgg(deps: BggDeps): { source: BggSource; account: BggAccount } {
  const client = createBggClient(deps)
  const account = createBggAccount(client, deps.now)
  return { source: createSource(client, deps.token), account }
}

function createSource(client: BggClient, token: string | undefined): BggSource {
  const web = new GeekdoSource({ client })
  if (!token) return web
  const official = new OfficialSource(client)
  return {
    fetchLimit: official.fetchLimit,
    getGames: ids => official.getGames(ids),
    search: (query, limit) => official.search(query, limit),
    getListPage: (kind, id, page) => (kind === 'geeklist' ? official : web).getListPage(kind, id, page),
    getCompanies: ids => web.getCompanies(ids),
    getGallery: bggId => web.getGallery(bggId),
    getMarketOffers: (bggId, rates) => official.getMarketOffers(bggId, rates),
    getCollection: (bggUser, options) => official.getCollection(bggUser, options),
  }
}
