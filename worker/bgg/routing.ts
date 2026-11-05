import { type BggCache, createBggClient } from './cache.ts'
import { GeekdoSource } from './geekdo.ts'
import { OfficialSource } from './official.ts'
import type { BggSource } from './source.ts'

/**
 * ADR 0007: with the token, game details, search and geeklists come from the official XML API; previews,
 * company names and galleries (not offered there) from the website JSON. Without it, the website JSON
 * serves everything and search is unavailable. Both share one client, so the 1 request/s limit holds.
 */
export function createBggSource(deps: {
  fetch: typeof fetch
  cache: BggCache
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  token?: string
  log?: (line: string) => void
}): BggSource {
  const client = createBggClient(deps)
  const web = new GeekdoSource({ client })
  if (!deps.token) return web
  const official = new OfficialSource(client)
  return {
    fetchLimit: official.fetchLimit,
    getGames: ids => official.getGames(ids),
    search: (query, limit) => official.search(query, limit),
    getListPage: (kind, id, page) => (kind === 'geeklist' ? official : web).getListPage(kind, id, page),
    getCompanies: ids => web.getCompanies(ids),
    getGallery: bggId => web.getGallery(bggId),
  }
}
