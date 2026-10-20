import type { GameDetails } from '../../src/domain/game-info.ts'
import type { GameGallery } from '../../src/domain/gallery.ts'
import type { Game } from '../db/repository.ts'

export type { Game }

export type ListKind = 'preview' | 'geeklist'

export type ListFacts = {
  booth: string | null
  priceCents: number | null
  currency: string | null
  publisherId: number | null
  publisher: string | null
  edition: string | null
}

export type ListEntry = {
  position: number
  bggId: number
  name: string
  thumbnailUrl: string | null
  facts?: ListFacts
  info?: Omit<GameDetails, 'publisher'>
}

export type ListPage = {
  kind: ListKind
  id: number
  title: string
  page: number
  pageCount: number
  entries: ListEntry[]
}

/**
 * Where BGG data comes from (ADR 0005): `GeekdoSource` reads BGG's public website JSON under the
 * constitution V exception (Release 0.5); `XmlApiSource` uses the official XML API with a token (1.0).
 */
export interface BggSource {
  getGames(ids: number[]): Promise<Game[]>
  getListPage(kind: ListKind, id: number, page: number): Promise<ListPage>
  getCompanies(ids: number[]): Promise<{ id: number; name: string }[]>
  /** F004: the game's image gallery; the official API has none, so it stays on the exception (research R1). */
  getGallery(bggId: number): Promise<GameGallery>
  search(query: string): Promise<Game[]>
}
