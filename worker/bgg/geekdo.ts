import { BggError, type BggCache, type BggClient, createBggClient } from './cache.ts'
import type { GameGallery } from '../../src/domain/gallery.ts'
import { getGames } from './geekdo-games.ts'
import { getGallery } from './geekdo-images.ts'
import { getCompanies, getListPage } from './geekdo-lists.ts'
import type { BggSource, Game, ListKind, ListPage } from './source.ts'

/**
 * Release 0.5 source: BGG's public website JSON on api.geekdo.com (constitution V exception, ADR 0005).
 * Game details live in geekdo-games.ts, lists and companies in geekdo-lists.ts.
 */
export class GeekdoSource implements BggSource {
  readonly client: BggClient

  constructor(deps: { fetch: typeof fetch; cache: BggCache; now?: () => number; sleep?: (ms: number) => Promise<void> }) {
    this.client = createBggClient(deps)
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

  async search(): Promise<Game[]> {
    throw new BggError('bgg_unavailable', 'Search needs the official BGG API (Release 1.0).')
  }
}
