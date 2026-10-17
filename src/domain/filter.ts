import type { Entry } from './collection.ts'
import { MARKS, type Mark, isMark } from './marks.ts'

/** Which games a collection shows (FR-009): any combination of groups, and all / not bought / bought. */
export type Bought = 'all' | 'no' | 'yes'
export type Filter = { groups: Set<Mark>; bought: Bought }
/** A filter as kept in `meta.activeFilter`, per collection. */
export type StoredFilter = { groups: Mark[]; bought: Bought }

const ALL_MARKS = MARKS.map(m => m.key)
const isBought = (value: unknown): value is Bought => value === 'all' || value === 'no' || value === 'yes'

export const PRESETS = {
  all: { groups: new Set<Mark>(ALL_MARKS), bought: 'all' } as Filter,
  hunt: { groups: new Set<Mark>(['must_have']), bought: 'no' } as Filter,
}

const passesBought = (entry: Entry, bought: Bought) => bought === 'all' || entry.bought === (bought === 'yes')

/** Live entries the filter lets through. */
export const applyFilter = (entries: Entry[], filter: Filter) =>
  entries.filter(e => !e.deleted && filter.groups.has(e.mark) && passesBought(e, filter.bought))

/** Games per group within the bought selection, for the group checkboxes. */
export function groupCounts(entries: Entry[], bought: Bought) {
  const counts = Object.fromEntries(ALL_MARKS.map(m => [m, 0])) as Record<Mark, number>
  for (const e of entries) if (!e.deleted && passesBought(e, bought)) counts[e.mark] += 1
  return counts
}

const sameGroups = (a: Set<Mark>, b: Set<Mark>) => a.size === b.size && [...a].every(m => b.has(m))

export function presetOf(filter: Filter): keyof typeof PRESETS | null {
  for (const key of ['all', 'hunt'] as const) {
    const preset = PRESETS[key]
    if (filter.bought === preset.bought && sameGroups(filter.groups, preset.groups)) return key
  }
  return null
}

const BOUGHT_SUFFIX: Record<Bought, string> = { all: '', no: ', not bought', yes: ', bought' }

/** The filter button's text: a preset's name, or the groups' symbols and the bought selection. */
export function filterLabel(filter: Filter): string {
  const preset = presetOf(filter)
  if (preset === 'all') return 'All games'
  if (preset === 'hunt') return '⭐ Must Have, not bought'
  if (filter.groups.size === 0) return 'Nothing selected'
  const groups = filter.groups.size === ALL_MARKS.length ? 'All groups' : MARKS.filter(m => filter.groups.has(m.key)).map(m => m.emoji).join(' ')
  return groups + BOUGHT_SUFFIX[filter.bought]
}

export const toStored = (filter: Filter): StoredFilter => ({
  groups: ALL_MARKS.filter(m => filter.groups.has(m)),
  bought: filter.bought,
})

/** Reads a stored filter back; unknown groups are dropped, anything unreadable means All. */
export function fromStored(value: unknown): Filter {
  if (!value || typeof value !== 'object') return PRESETS.all
  const { groups, bought } = value as Partial<StoredFilter>
  if (!Array.isArray(groups)) return PRESETS.all
  return { groups: new Set(groups.filter(isMark)), bought: isBought(bought) ? bought : 'all' }
}
