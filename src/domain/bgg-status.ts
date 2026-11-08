/**
 * F008: a game's statuses in a person's BoardGameGeek collection (data-model.md "Status").
 * Pure rules shared by app and Worker (labels, badges, lists, diff, merging copies, BGG flags).
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

export const NO_STATUS: Status = {
  own: false, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null,
}

/** List names (Lists › BGG statuses). */
export const STATUS_NAMES: Record<StatusKey, string> = {
  own: 'Owned', preordered: 'Preordered', wishlist: 'Wishlist', wantToPlay: 'Want to play',
  forTrade: 'For trade', wantInTrade: 'Want in trade', wantToBuy: 'Want to buy', prevOwned: 'Previously owned',
}

export const PRIORITY_NAMES: Record<WishlistPriority, string> = {
  1: 'Must have', 2: 'Love to have', 3: 'Like to have', 4: 'Thinking about it', 5: "Don't buy this",
}

export const isSet = (status: Status, key: StatusKey) => key === 'wishlist' ? status.wishlist !== null : status[key]

export const hasAny = (status: Status) => STATUS_KEYS.some(key => isSet(status, key))

/** Badge text: "Wishlist 2" for the wishlist, else the list name. */
export const label = (key: StatusKey, status: Status) =>
  key === 'wishlist' && status.wishlist !== null ? `Wishlist ${status.wishlist}` : STATUS_NAMES[key]

export function badges(status: Status, max = Infinity): { shown: StatusKey[]; rest: number } {
  const set = STATUS_KEYS.filter(key => isSet(status, key))
  return { shown: set.slice(0, max), rest: Math.max(0, set.length - max) }
}

const byName = new Intl.Collator('en', { sensitivity: 'base' }).compare

export function statusList(items: BggCollectionItem[], key: StatusKey): BggCollectionItem[] {
  return items
    .filter(item => isSet(item.status, key))
    .sort((a, b) => (key === 'wishlist' ? a.status.wishlist! - b.status.wishlist! : 0) || byName(a.name, b.name))
}

export function counts(items: BggCollectionItem[]): Record<StatusKey, number> {
  return Object.fromEntries(STATUS_KEYS.map(key => [key, items.filter(item => isSet(item.status, key)).length])) as Record<StatusKey, number>
}

/** Only the changed keys (FR-017); {} when equal. */
export function diff(before: Status, after: Status): StatusChange {
  const change: Record<string, unknown> = {}
  for (const key of Object.keys(after) as (keyof Status)[]) if (before[key] !== after[key]) change[key] = after[key]
  return change as StatusChange
}

const minPriority = (a: WishlistPriority | null, b: WishlistPriority | null) => a === null ? b : b === null ? a : Math.min(a, b) as WishlistPriority

/** One item per game: a flag counts if any copy has it, the wishlist takes the most wanted priority. */
export function mergeCopies(items: BggCollectionItem[]): BggCollectionItem[] {
  const merged = new Map<number, BggCollectionItem>()
  for (const item of items) {
    const seen = merged.get(item.bggId)
    if (!seen) { merged.set(item.bggId, { ...item, status: { ...item.status } }); continue }
    const a = seen.status, b = item.status
    seen.status = {
      own: a.own || b.own, prevOwned: a.prevOwned || b.prevOwned, forTrade: a.forTrade || b.forTrade, wantInTrade: a.wantInTrade || b.wantInTrade,
      wantToBuy: a.wantToBuy || b.wantToBuy, wantToPlay: a.wantToPlay || b.wantToPlay, preordered: a.preordered || b.preordered,
      wishlist: minPriority(a.wishlist, b.wishlist),
    }
  }
  return [...merged.values()]
}

type BggFlag = string | undefined
export type BggFlags = {
  own: BggFlag; prevowned: BggFlag; fortrade: BggFlag; want: BggFlag; wanttoplay: BggFlag
  wanttobuy: BggFlag; wishlist: BggFlag; wishlistpriority: BggFlag; preordered: BggFlag
}

/** BGG's XML `<status>` attributes ("0"/"1"); `want` = Want in trade; wishlist without a valid priority → 3. */
export function fromBggFlags(flags: BggFlags): Status {
  const on = (flag: BggFlag) => flag === '1'
  const priority = Number(flags.wishlistpriority)
  return {
    own: on(flags.own), prevOwned: on(flags.prevowned), forTrade: on(flags.fortrade), wantInTrade: on(flags.want),
    wantToBuy: on(flags.wanttobuy), wantToPlay: on(flags.wanttoplay), preordered: on(flags.preordered),
    wishlist: on(flags.wishlist) ? (Number.isInteger(priority) && priority >= 1 && priority <= 5 ? priority as WishlistPriority : 3) : null,
  }
}

/** What the app knows when a game is ticked off as bought (data-model.md "PrivateInfo"). */
export type BoughtInfo = {
  pricePaid?: { amount: number; currency: string }
  /** The entry's booth; counts only when it comes from a SPIEL preview. */
  booth?: string | null
  fromSpiel?: boolean
  /** The shop of the offer chosen on the game's prices. */
  offerShop?: string
}

const ACQUIRED_FROM_MAX = 100
const pad = (n: number) => String(n).padStart(2, '0')

/** The private info sent once after buying: price when entered, the device's date, where it was bought. */
export function privateInfoFor(bought: BoughtInfo, today: Date): PrivateInfo {
  const booth = bought.fromSpiel ? bought.booth?.trim() : ''
  const from = booth ? `SPIEL Essen 2026 · booth ${booth}` : bought.offerShop?.trim()
  return {
    ...(bought.pricePaid ? { pricePaid: bought.pricePaid } : {}),
    acquisitionDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    ...(from ? { acquiredFrom: from.slice(0, ACQUIRED_FROM_MAX) } : {}),
  }
}

/** After ticking a game as bought (FR-021): offer marking it as owned, adding the price, or nothing. */
export const askAfterBought = (status: Status | undefined, hasPrice: boolean): 'markOwned' | 'addPrice' | null =>
  !status?.own ? 'markOwned' : hasPrice ? 'addPrice' : null
