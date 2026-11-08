/**
 * F008: a game's statuses in a person's BoardGameGeek collection (data-model.md "Status").
 * Skeleton (T003): the types every block shares; the functions follow in T005.
 */

/** In badge order (FR-009). */
export const STATUS_KEYS = ['own', 'preordered', 'wishlist', 'wantToPlay', 'forTrade', 'wantInTrade', 'wantToBuy', 'prevOwned'] as const
export type StatusKey = (typeof STATUS_KEYS)[number]

export type WishlistPriority = 1 | 2 | 3 | 4 | 5

export type Status = {
  own: boolean
  prevOwned: boolean
  forTrade: boolean
  wantInTrade: boolean
  wantToBuy: boolean
  wantToPlay: boolean
  preordered: boolean
  /** null = not on the wishlist */
  wishlist: WishlistPriority | null
}

/** One game of a person's BGG collection (copies merged). */
export type BggCollectionItem = {
  bggId: number
  name: string
  year: number | null
  thumbnailUrl: string | null
  kind: 'boardgame' | 'expansion'
  status: Status
}

/** `GET /api/bgg/collection` (contracts/api.md). */
export type BggCollectionAnswer = { bggUser: string; loadedAt: string; items: BggCollectionItem[] }

/** What a save sends: only the changed keys (FR-017). */
export type StatusChange = Partial<Status>

/** Sent once after buying (data-model.md "PrivateInfo"). */
export type PrivateInfo = {
  pricePaid?: { amount: number; currency: string }
  acquisitionDate?: string
  acquiredFrom?: string
}

/** Badge colours (data-model.md "Device meta"). */
export const PALETTE = ['cool', 'hot', 'mint', 'pink', 'white', 'violet', 'dusk', 'red', 'mud', 'grey'] as const
export type PaletteName = (typeof PALETTE)[number]
export const DEFAULT_BADGE_COLOURS: Record<StatusKey, PaletteName> = {
  own: 'cool', preordered: 'dusk', wishlist: 'pink', wantToPlay: 'violet', forTrade: 'hot', wantInTrade: 'white', wantToBuy: 'mint', prevOwned: 'grey',
}
