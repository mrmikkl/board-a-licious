import type { Entry } from './collection.ts'
import { MARKS, type Mark, isMark } from './marks.ts'

/**
 * Which games a collection shows (FR-009): any combination of groups, all / not bought / bought, and
 * a price band of the listed price.
 */
export type Bought = 'all' | 'no' | 'yes'
export type Price = 'all' | 'cheap' | 'mid' | 'expensive'
export type Filter = { groups: Set<Mark>; bought: Bought; price: Price }
/** A filter as kept in `meta.activeFilter`, per collection. */
export type StoredFilter = { groups: Mark[]; bought: Bought; price?: Price }

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

const ALL_MARKS = MARKS.map(m => m.key)
const isBought = (value: unknown): value is Bought => value === 'all' || value === 'no' || value === 'yes'

export const PRESETS = {
  all: { groups: new Set<Mark>(ALL_MARKS), bought: 'all', price: 'all' } as Filter,
  hunt: { groups: new Set<Mark>(['must_have']), bought: 'no', price: 'all' } as Filter,
}

const passesBought = (entry: Entry, bought: Bought) => bought === 'all' || entry.bought === (bought === 'yes')

/** Live entries the filter lets through. */
export const applyFilter = (entries: Entry[], filter: Filter) =>
  entries.filter(e => !e.deleted && filter.groups.has(e.mark) && passesBought(e, filter.bought) && passesPrice(e, filter.price))

/** Games per group within the bought and price selection, for the group checkboxes. */
export function groupCounts(entries: Entry[], bought: Bought, price: Price = 'all') {
  const counts = Object.fromEntries(ALL_MARKS.map(m => [m, 0])) as Record<Mark, number>
  for (const e of entries) if (!e.deleted && passesBought(e, bought) && passesPrice(e, price)) counts[e.mark] += 1
  return counts
}

const sameGroups = (a: Set<Mark>, b: Set<Mark>) => a.size === b.size && [...a].every(m => b.has(m))

export function presetOf(filter: Filter): keyof typeof PRESETS | null {
  for (const key of ['all', 'hunt'] as const) {
    const preset = PRESETS[key]
    if (filter.bought === preset.bought && filter.price === preset.price && sameGroups(filter.groups, preset.groups)) return key
  }
  return null
}

const BOUGHT_SUFFIX: Record<Bought, string> = { all: '', no: ', not bought', yes: ', bought' }
const PRICE_SUFFIX: Record<Price, string> = { all: '', cheap: ', cheap', mid: ', mid', expensive: ', expensive' }

/** The filter button's text: a preset's name, or the groups' symbols and the bought selection. */
export function filterLabel(filter: Filter): string {
  const preset = presetOf(filter)
  if (preset === 'all') return 'All games'
  if (preset === 'hunt') return '⭐ Must Have, not bought'
  if (filter.groups.size === 0) return 'Nothing selected'
  const groups = filter.groups.size === ALL_MARKS.length ? 'All groups' : MARKS.filter(m => filter.groups.has(m.key)).map(m => m.emoji).join(' ')
  return groups + BOUGHT_SUFFIX[filter.bought] + PRICE_SUFFIX[filter.price]
}

export const toStored = (filter: Filter): StoredFilter => ({
  groups: ALL_MARKS.filter(m => filter.groups.has(m)),
  bought: filter.bought,
  price: filter.price,
})

/** Reads a stored filter back; unknown groups are dropped, anything unreadable means All. */
export function fromStored(value: unknown): Filter {
  if (!value || typeof value !== 'object') return PRESETS.all
  const { groups, bought, price } = value as Partial<StoredFilter>
  if (!Array.isArray(groups)) return PRESETS.all
  return { groups: new Set(groups.filter(isMark)), bought: isBought(bought) ? bought : 'all', price: isPrice(price) ? price : 'all' }
}
