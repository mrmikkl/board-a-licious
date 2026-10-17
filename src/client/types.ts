import type { Facts } from '../domain/collection.ts'

export type Game = {
  bggId: number
  name: string
  year: number | null
  thumbnailUrl: string | null
  description: string | null
  kind: 'boardgame' | 'expansion'
}

export type ListKind = 'preview' | 'geeklist'

export type ListEntryFacts = Facts & { publisherId?: number | null }

export type StoredListEntry = {
  position: number
  bggId: number
  name: string
  thumbnailUrl: string | null
  facts?: ListEntryFacts
  /** The list page the entry came from; a reload replaces entries page by page. */
  page?: number
}

/** A BGG list loaded on this device (data-model.md, "BGG list"). */
export type StoredList = {
  kind: ListKind
  id: number
  title: string
  isEssen: boolean
  pageCount: number
  loadedPages: number
  entries: StoredListEntry[]
  openedAt: string
  /** When the pages were last fetched completely; a reload after 1 h refreshes them. */
  loadedAt?: string
  error?: string
}
