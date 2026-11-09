import { type Status } from './bgg-status.ts'
import type { Entry } from './collection.ts'
import {
  type FilterDetails,
  type GameFilter,
  type LengthLimits,
  type StoredGameFilter,
  fromStoredGameFilter,
  isDefaultGameFilter,
  matchesGame,
  toStoredGameFilter,
} from './game-filter.ts'
import { MARKS, type Mark, isMark } from './marks.ts'

/**
 * Which games a collection shows (FR-009): any combination of groups, all / not bought / bought, and
 * a price band of the listed price, (F008 FR-010) the game's status in the person's BGG collection, and
 * (F009 FR-013) what BGG says about the game; a missing `game` filters nothing.
 */
export type Bought = 'all' | 'no' | 'yes'
export type Price = 'all' | 'cheap' | 'mid' | 'expensive'
/** Owned on BGG, not owned (also without a known status), on the BGG wishlist; missing means all. */
export type BggFilter = 'all' | 'own' | 'notOwn' | 'wishlist'
export type Filter = { groups: Set<Mark>; bought: Bought; price: Price; bgg?: BggFilter; game?: GameFilter; buy?: { before: Filter } }
/** A filter as kept in `meta.activeFilter`, per collection. */
export type StoredFilter = { groups: Mark[]; bought: Bought; price?: Price; bgg?: BggFilter; game?: StoredGameFilter; buy?: { before: StoredFilter } }
/** The person's BGG status of a game, undefined when unknown. */
export type StatusOf = (bggId: number) => Status | undefined
/** F009: the BGG details of each game (undefined while not on the device) and the length limits. */
export type GameDetailsOf = { details: (bggId: number) => FilterDetails; limits: LengthLimits }

/** Price bands in cents of the listed price: cheap up to 30, mid over 30 up to 60, expensive over 60. */
export const CHEAP_MAX = 3000
export const MID_MAX = 6000

/** The band of a game's listed price, or null without a price. */
export function priceBand(entry: Entry): Exclude<Price, 'all'> | null {
  const cents = entry.facts?.priceCents
  if (cents === null || cents === undefined) return null
  return cents <= CHEAP_MAX ? 'cheap' : cents <= MID_MAX ? 'mid' : 'expensive'
}
const passesPrice = (entry: Entry, price: Price) => price === 'all' || priceBand(entry) === price
const isPrice = (value: unknown): value is Price => value === 'all' || value === 'cheap' || value === 'mid' || value === 'expensive'

const isBggFilter = (value: unknown): value is BggFilter => value === 'all' || value === 'own' || value === 'notOwn' || value === 'wishlist'
const NO_STATUSES: StatusOf = () => undefined
function passesBgg(entry: Entry, bgg: BggFilter = 'all', statusOf: StatusOf) {
  if (bgg === 'all') return true
  const status = statusOf(entry.bggId)
  return bgg === 'own' ? !!status?.own : bgg === 'notOwn' ? !status?.own : status?.wishlist != null
}

/** A set game filter only lets through games whose details match it; without details nothing matches. */
const hasGameFilter = (game: GameFilter | undefined): game is GameFilter => !!game && !isDefaultGameFilter(game)
const passesGame = (entry: Entry, game: GameFilter | undefined, of: GameDetailsOf | undefined) =>
  !hasGameFilter(game) || (!!of && matchesGame(of.details(entry.bggId), game, of.limits))

const ALL_MARKS = MARKS.map(m => m.key)
const isBought = (value: unknown): value is Bought => value === 'all' || value === 'no' || value === 'yes'

export const PRESETS = {
  all: { groups: new Set<Mark>(ALL_MARKS), bought: 'all', price: 'all' } as Filter,
  hunt: { groups: new Set<Mark>(['must_have']), bought: 'no', price: 'all' } as Filter,
}

/** The Buy quick filter (F005 R5): the games still to buy, the filter before kept to come back to. */
export function buyOn(filter: Filter): Filter {
  const before = filter.buy ? filter.buy.before : filter
  return { groups: new Set<Mark>(['must_have', 'interested', 'unsure']), bought: 'no', price: 'all', buy: { before } }
}

export const buyOff = (filter: Filter): Filter => filter.buy?.before ?? filter

/** A change in the Filter and group sheet turns the Buy quick filter off (F005 R5): the same filter, without it. */
export const dropBuy = (filter: Filter): Filter =>
  ({ groups: filter.groups, bought: filter.bought, price: filter.price, ...(filter.bgg ? { bgg: filter.bgg } : {}), ...(filter.game ? { game: filter.game } : {}) })

/** The Filter action is highlighted unless this is the default view: All categories, all, grouped by categories. */
export const isDefaultView = (filter: Filter, groupBy: 'mark' | 'booth') => groupBy === 'mark' && !filter.buy && presetOf(filter) === 'all'

const passesBought = (entry: Entry, bought: Bought) => bought === 'all' || entry.bought === (bought === 'yes')

/** Live entries the filter lets through; a set game filter reads each entry's details from `gameOf`. */
export const applyFilter = (entries: Entry[], filter: Filter, statusOf: StatusOf = NO_STATUSES, gameOf?: GameDetailsOf) =>
  entries.filter(e => !e.deleted && filter.groups.has(e.mark) && passesBought(e, filter.bought) && passesPrice(e, filter.price)
    && passesBgg(e, filter.bgg, statusOf) && passesGame(e, filter.game, gameOf))

/** Games per group within the bought, price, BGG and game selection, for the group checkboxes. */
export function groupCounts(
  entries: Entry[], bought: Bought, price: Price = 'all', bgg: BggFilter = 'all', statusOf: StatusOf = NO_STATUSES, game?: GameFilter, gameOf?: GameDetailsOf,
) {
  const counts = Object.fromEntries(ALL_MARKS.map(m => [m, 0])) as Record<Mark, number>
  for (const e of entries)
    if (!e.deleted && passesBought(e, bought) && passesPrice(e, price) && passesBgg(e, bgg, statusOf) && passesGame(e, game, gameOf)) counts[e.mark] += 1
  return counts
}

const sameGroups = (a: Set<Mark>, b: Set<Mark>) => a.size === b.size && [...a].every(m => b.has(m))

export function presetOf(filter: Filter): keyof typeof PRESETS | null {
  for (const key of ['all', 'hunt'] as const) {
    const preset = PRESETS[key]
    if ((filter.bgg ?? 'all') === 'all' && !hasGameFilter(filter.game) && filter.bought === preset.bought && filter.price === preset.price && sameGroups(filter.groups, preset.groups)) return key
  }
  return null
}

const BOUGHT_SUFFIX: Record<Bought, string> = { all: '', no: ', not bought', yes: ', bought' }
const PRICE_SUFFIX: Record<Price, string> = { all: '', cheap: ', cheap', mid: ', mid', expensive: ', expensive' }
const BGG_SUFFIX: Record<BggFilter, string> = { all: '', own: ', owned on BGG', notOwn: ', not owned on BGG', wishlist: ', on BGG wishlist' }

/** The filter button's text: a preset's name, or the groups' symbols and the bought selection. */
export function filterLabel(filter: Filter): string {
  const preset = presetOf(filter)
  if (preset === 'all') return 'All games'
  if (preset === 'hunt') return '⭐ Must Have, not bought'
  if (filter.groups.size === 0) return 'Nothing selected'
  const groups = filter.groups.size === ALL_MARKS.length ? 'All categories' : MARKS.filter(m => filter.groups.has(m.key)).map(m => m.emoji).join(' ')
  return groups + BOUGHT_SUFFIX[filter.bought] + PRICE_SUFFIX[filter.price] + BGG_SUFFIX[filter.bgg ?? 'all']
}

export const toStored = (filter: Filter): StoredFilter => ({
  groups: ALL_MARKS.filter(m => filter.groups.has(m)),
  bought: filter.bought,
  price: filter.price,
  ...(filter.bgg && filter.bgg !== 'all' ? { bgg: filter.bgg } : {}),
  ...(hasGameFilter(filter.game) ? { game: toStoredGameFilter(filter.game) } : {}),
  ...(filter.buy ? { buy: { before: toStored(filter.buy.before) } } : {}),
})

/** Reads a stored filter back; unknown groups are dropped, anything unreadable means All. */
export function fromStored(value: unknown): Filter {
  if (!value || typeof value !== 'object') return PRESETS.all
  const { groups, bought, price, bgg, game, buy } = value as Partial<StoredFilter>
  const gameFilter = fromStoredGameFilter(game)
  if (!Array.isArray(groups)) return PRESETS.all
  const filter: Filter = {
    groups: new Set(groups.filter(isMark)), bought: isBought(bought) ? bought : 'all', price: isPrice(price) ? price : 'all',
    ...(isBggFilter(bgg) && bgg !== 'all' ? { bgg } : {}),
    ...(hasGameFilter(gameFilter) ? { game: gameFilter } : {}),
  }
  return buy && typeof buy === 'object' ? { ...filter, buy: { before: fromStored(buy.before) } } : filter
}
