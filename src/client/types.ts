import type { Facts } from '../domain/collection.ts'
import type { GameDetails } from '../domain/game-info.ts'

export type Game = {
  bggId: number
  name: string
  year: number | null
  thumbnailUrl: string | null
  description: string | null
  kind: 'boardgame' | 'expansion'
} & Partial<GameDetails>
// (games stored before the game info existed lack these fields and are fetched again, FR-017)

export type ListKind = 'preview' | 'geeklist'

export type ListEntryFacts = Facts & { publisherId?: number | null }

export type StoredListEntry = {
  position: number
  bggId: number
  name: string
  thumbnailUrl: string | null
  facts?: ListEntryFacts
  /** Players, designers and mechanisms as a BGG preview lists them. */
  info?: Omit<GameDetails, 'publisher'>
  /** The list page the entry came from; a reload replaces entries page by page. */
  page?: number
}

/** A BGG list loaded on this device (data-model.md, "BGG list"). */
export type StoredList = {
  /** Every item as BGG lists it (one per edition or publisher); `entries` merges them per game. */
  items?: StoredListEntry[]
  /** The list was sent to the person's other devices (or came from one). */
  shared?: boolean
  kind: ListKind
  id: number
  title: string
  pageCount: number
  loadedPages: number
  entries: StoredListEntry[]
  openedAt: string
  /** When the pages were last fetched completely; a reload after 1 h refreshes them. */
  loadedAt?: string
  error?: string
}
