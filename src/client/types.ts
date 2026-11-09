import type { BggCollectionItem } from '../domain/bgg-status.ts'
import type { Facts } from '../domain/collection.ts'
import type { LengthLimits } from '../domain/game-filter.ts'
import type { GameDetails } from '../domain/game-info.ts'

export type Game = {
  bggId: number
  name: string
  year: number | null
  thumbnailUrl: string | null
  description: string | null
  kind: 'boardgame' | 'expansion'
} & Partial<GameDetails>
// (games stored before the game info existed lack these fields and are fetched again, FR-017;
// F009: a game without the key `playingTime` was stored before it existed and counts as missing details)

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

/**
 * F008: the person's BGG username, synced (data-model.md "UserSetting"); null = none. F009: their
 * length limits, null = the defaults; without the key (older rows) the server keeps what it has.
 */
export type UserSetting = { bggUsername: string | null; lengthLimits?: LengthLimits | null; updatedAt: string }

/** F008: a friend's BGG user whose lists were loaded by link, synced; lower-cased, `deleted` = tombstone. */
export type FollowedBggUser = { bggUser: string; updatedAt: string; deleted: boolean }

/** F008: a person's BGG collection on this device (data-model.md "BggCollection"), keyed by lower-cased `bggUser`. */
export type StoredBggCollection = {
  bggUser: string
  items: BggCollectionItem[]
  /** When it was last read from BGG (or found missing); null before the first answer. */
  loadedAt: string | null
  error: 'not_found' | 'private' | null
}
