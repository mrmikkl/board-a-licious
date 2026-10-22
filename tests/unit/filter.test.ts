import { describe, expect, it } from 'vitest'

import { type Entry, newEntry } from '../../src/domain/collection.ts'
import {
  type Filter,
  PRESETS,
  applyFilter,
  filterLabel,
  fromStored,
  groupCounts,
  presetOf,
  priceBand,
  toStored,
} from '../../src/domain/filter.ts'
import type { Mark } from '../../src/domain/marks.ts'
import { formatMoney, parsePrice, priceInput } from '../../src/domain/money.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const entry = (bggId: number, mark: Mark, bought = false): Entry => ({ ...newEntry('c1', bggId, T1), mark, bought })

const entries = [
  entry(1, 'new'),
  entry(2, 'must_have'),
  entry(3, 'must_have', true),
  entry(4, 'interested', true),
  entry(5, 'skip'),
  { ...entry(6, 'must_have'), deleted: true },
]
const ids = (list: Entry[]) => list.map(e => e.bggId)
const filter = (groups: Mark[], bought: Filter['bought'], price: Filter['price'] = 'all'): Filter => ({ groups: new Set(groups), bought, price })
const priced = (bggId: number, cents: number | null): Entry => ({
  ...entry(bggId, 'must_have'),
  facts: cents === null ? null : { booth: null, priceCents: cents, currency: 'EUR', publisher: null },
})

describe('filter by price (listed price)', () => {
  it('sorts prices into cheap (up to 30), mid (over 30 up to 60) and expensive (over 60)', () => {
    expect([2999, 3000, 3001, 6000, 6001].map(c => priceBand(priced(1, c)))).toEqual(['cheap', 'cheap', 'mid', 'mid', 'expensive'])
    expect(priceBand(priced(1, null))).toBeNull()
  })

  it('shows only games in the chosen band; games without a price only under All', () => {
    const list = [priced(1, 2500), priced(2, 4500), priced(3, 9000), priced(4, null)]
    const all = new Set<Mark>(['must_have'])
    expect(ids(applyFilter(list, { groups: all, bought: 'all', price: 'all' }))).toEqual([1, 2, 3, 4])
    expect(ids(applyFilter(list, { groups: all, bought: 'all', price: 'cheap' }))).toEqual([1])
    expect(ids(applyFilter(list, { groups: all, bought: 'all', price: 'mid' }))).toEqual([2])
    expect(ids(applyFilter(list, { groups: all, bought: 'all', price: 'expensive' }))).toEqual([3])
  })

  it('names the price in the filter button and keeps it when stored', () => {
    expect(filterLabel(filter(['must_have', 'interested'], 'all', 'cheap'))).toBe('⭐ 👀, cheap')
    expect(fromStored(toStored(filter(['must_have'], 'no', 'expensive')))).toEqual(filter(['must_have'], 'no', 'expensive'))
    expect(fromStored({ groups: ['must_have'], bought: 'no' }).price).toBe('all')
  })
})

describe('filter (FR-009)', () => {
  it('"All" shows every live game', () => {
    expect(ids(applyFilter(entries, PRESETS.all))).toEqual([1, 2, 3, 4, 5])
  })

  it('"Must Have, not bought" (hunt) is the Must Have group and Not bought', () => {
    expect(PRESETS.hunt).toEqual(filter(['must_have'], 'no'))
    expect(ids(applyFilter(entries, PRESETS.hunt))).toEqual([2])
  })

  it('combines any groups with all / not bought / bought', () => {
    expect(ids(applyFilter(entries, filter(['must_have', 'interested'], 'all')))).toEqual([2, 3, 4])
    expect(ids(applyFilter(entries, filter(['must_have', 'interested'], 'yes')))).toEqual([3, 4])
    expect(ids(applyFilter(entries, filter(['new', 'skip'], 'no')))).toEqual([1, 5])
    expect(ids(applyFilter(entries, filter([], 'all')))).toEqual([])
  })

  it('counts games per group within the bought selection', () => {
    expect(groupCounts(entries, 'all')).toEqual({ new: 1, must_have: 2, interested: 1, unsure: 0, later: 0, poop: 0, skip: 1 })
    expect(groupCounts(entries, 'yes')).toEqual({ new: 0, must_have: 1, interested: 1, unsure: 0, later: 0, poop: 0, skip: 0 })
  })

  it('knows which preset is selected', () => {
    expect(presetOf(PRESETS.all)).toBe('all')
    expect(presetOf(filter(['must_have'], 'no'))).toBe('hunt')
    expect(presetOf(filter(['must_have'], 'all'))).toBeNull()
  })

  it('labels the filter button with the selection', () => {
    expect(filterLabel(PRESETS.all)).toBe('All games')
    expect(filterLabel(PRESETS.hunt)).toBe('⭐ Must Have, not bought')
    expect(filterLabel(filter([], 'all'))).toBe('Nothing selected')
    expect(filterLabel(filter(['new', 'must_have', 'interested', 'unsure', 'later', 'poop', 'skip'], 'yes'))).toBe('All groups, bought')
    expect(filterLabel(filter(['must_have', 'interested'], 'all'))).toBe('⭐ 👀')
    expect(filterLabel(filter(['new', 'poop'], 'no'))).toBe('⬡ 💩, not bought')
  })

  it('is stored as plain JSON and read back; anything unknown falls back to All', () => {
    const stored = toStored(PRESETS.hunt)
    expect(JSON.parse(JSON.stringify(stored))).toEqual({ groups: ['must_have'], bought: 'no', price: 'all' })
    expect(fromStored(stored)).toEqual(PRESETS.hunt)
    expect(fromStored(undefined)).toEqual(PRESETS.all)
    expect(fromStored({ groups: ['must_have', 'nonsense'], bought: 'maybe' })).toEqual(filter(['must_have'], 'all'))
  })
})

describe('prices (FR-007)', () => {
  it('parses whole units and up to two decimals, comma or point, into cents', () => {
    expect(parsePrice('52')).toBe(5200)
    expect(parsePrice('12,50')).toBe(1250)
    expect(parsePrice('12.50')).toBe(1250)
    expect(parsePrice(' 12.5 ')).toBe(1250)
    expect(parsePrice('0')).toBe(0)
    expect(parsePrice('9999')).toBe(999900)
  })

  it('rejects empty, negative, too many decimals and more than 9,999', () => {
    for (const text of ['', ' ', '-1', '12.345', '10000', '9999.01', 'abc', '1,2,3', '€52']) expect(parsePrice(text)).toBeNull()
  })

  it('shows prices without cents when whole', () => {
    expect(formatMoney(5200, 'EUR')).toBe('€52')
    expect(formatMoney(1250, 'EUR')).toBe('€12.50')
    expect(formatMoney(1250, null)).toBe('€12.50')
  })

  it('prefills a price input from cents', () => {
    expect(priceInput(5200)).toBe('52')
    expect(priceInput(1250)).toBe('12.50')
    expect(priceInput(null)).toBe('')
  })
})
