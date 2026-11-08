import { BggError, type BggCache, type BggClient, createBggClient } from './cache.ts'
import type { GameGallery } from '../../src/domain/gallery.ts'
import { getGames } from './geekdo-games.ts'
import { getGallery } from './geekdo-images.ts'
import { getCompanies, getListPage } from './geekdo-lists.ts'
import type { Offer } from '../../src/domain/offers.ts'
import type { BggCollectionItem, BggSource, Game, ListKind, ListPage, SearchResult } from './source.ts'

/**
 * Release 0.5 source: BGG's public website JSON on api.geekdo.com (constitution V exception, ADR 0005).
 * Game details live in geekdo-games.ts, lists and companies in geekdo-lists.ts.
 */
export class GeekdoSource implements BggSource {
  readonly client: BggClient
  /** two requests per game (details, ratings) */
  readonly fetchLimit = 10

  constructor(deps: { fetch: typeof fetch; cache: BggCache; now?: () => number; sleep?: (ms: number) => Promise<void> } | { client: BggClient }) {
    this.client = 'client' in deps ? deps.client : createBggClient(deps)
  }

  getGames(ids: number[]): Promise<Game[]> {
    return getGames(this.client, ids)
  }

  getListPage(kind: ListKind, id: number, page: number): Promise<ListPage> {
    return getListPage(this.client, kind, id, page)
  }

  getCompanies(ids: number[]): Promise<{ id: number; name: string }[]> {
    return getCompanies(this.client, ids)
  }

  getGallery(bggId: number): Promise<GameGallery> {
    return getGallery(this.client, bggId)
  }

  /** The marketplace needs the official API: no website fallback (constitution V). */
  async getMarketOffers(): Promise<Offer[]> {
    return []
  }

  /** Collections need the official API: the website JSON is not used for them (constitution V, ADR 0007). */
  async getCollection(_bggUser: string): Promise<BggCollectionItem[]> {
    throw new BggError('bgg_unavailable', 'Reading BoardGameGeek collections needs the official API token.')
  }

  async search(): Promise<SearchResult[]> {
    throw new BggError('bgg_search_unavailable', 'Searching BoardGameGeek needs the official API token.')
  }
}
