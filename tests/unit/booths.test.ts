import { describe, expect, it } from 'vitest'

import { type Entry, newEntry } from '../../src/domain/collection.ts'
import { groupByHall, hallsOf } from '../../src/domain/booths.ts'

const T = '2026-10-17T09:00:00.000Z'
const entry = (bggId: number, booth: string | null): Entry => ({
  ...newEntry('c1', bggId, T),
  facts: booth === null ? null : { booth, priceCents: null, currency: null, publisher: null },
})

describe('halls from booth numbers', () => {
  it.each([
    ['3-R400', ['3']],
    ['1-A202', ['1']],
    ['7-C111 / 3-V300', ['3', '7']],
    ['4-G200 / 4-G210', ['4']],
    ['Galeria-G101', ['Galeria']],
    ['  2-e610 ', ['2']],
    ['R400', []],
    ['', []],
  ])('%s → %j', (booth, halls) => {
    expect(hallsOf(booth)).toEqual(halls)
  })
})

describe('grouping a collection by hall', () => {
  const names = new Map([
    [1, 'Cascadia'],
    [2, 'Ark Nova'],
    [3, 'Brass'],
    [4, 'Kalypso'],
    [5, 'Unknown booth'],
  ])
  const nameOf = (e: Entry) => names.get(e.bggId) ?? ''

  it('groups halls in number order, games by booth, a game with two booths in both halls, no booth last', () => {
    const groups = groupByHall(
      [entry(1, '3-R400'), entry(2, '1-A202'), entry(3, '7-C111 / 3-V300'), entry(4, '3-A100'), entry(5, null), { ...entry(6, '10-B1'), deleted: true }],
      nameOf,
    )
    expect(groups.map(g => [g.key, g.label, g.entries.map(e => e.bggId)])).toEqual([
      ['1', 'Hall 1', [2]],
      ['3', 'Hall 3', [4, 1, 3]],
      ['7', 'Hall 7', [3]],
      ['none', 'No booth yet', [5]],
    ])
  })

  it('puts named halls after numbered ones', () => {
    const groups = groupByHall([entry(1, 'Galeria-G101'), entry(2, '12-A1'), entry(3, '2-B2')], nameOf)
    expect(groups.map(g => g.label)).toEqual(['Hall 2', 'Hall 12', 'Galeria'])
  })
})
