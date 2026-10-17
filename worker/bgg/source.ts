import type { Game } from '../db/repository.ts'

export type { Game }

export type ListKind = 'preview' | 'geeklist'

export type ListFacts = {
  booth: string | null
  priceCents: number | null
  currency: string | null
  publisherId: number | null
  publisher: string | null
}

export type ListEntry = {
  position: number
  bggId: number
  name: string
  thumbnailUrl: string | null
  facts?: ListFacts
}

export type ListPage = {
  kind: ListKind
  id: number
  title: string
  isEssen: boolean
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
  search(query: string): Promise<Game[]>
}
