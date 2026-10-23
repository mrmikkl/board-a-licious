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
    ['3', ['3']],
    ['Hall 3', ['3']],
    ['hall 12', ['12']],
    ['7-C111 / 3', ['3', '7']],
    ['Hall foyer', []],
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

  it('groups exactly the games it is given, Not interested ones included (the screen filters)', () => {
    const groups = groupByHall([entry(1, '3-R400'), { ...entry(2, '3-A100'), mark: 'skip' }, { ...entry(3, null), mark: 'skip' }], nameOf)
    expect(groups.map(g => [g.label, g.entries.map(e => e.bggId)])).toEqual([
      ['Hall 3', [1, 2]], // F005: by category first, Not interested last
      ['No booth yet', [3]],
    ])
  })
})

describe('booths given as a hall only (F005 R6)', () => {
  const nameOf = (e: Entry) => `Game ${e.bggId}`

  it('"3" and "Hall 3" are a hall without a booth', () => {
    const groups = groupByHall([entry(1, '3'), entry(2, 'Hall 3')], nameOf)
    expect(groups.map(g => [g.label, g.entries.map(e => e.bggId)])).toEqual([['Hall 3', [1, 2]]])
  })

  it('"7-C111 / 3" is in Hall 7 and Hall 3', () => {
    const groups = groupByHall([entry(1, '7-C111 / 3')], nameOf)
    expect(groups.map(g => g.label)).toEqual(['Hall 3', 'Hall 7'])
  })

  it('"3-A100 / 3" is listed once, in Hall 3, with its booth', () => {
    const groups = groupByHall([entry(1, '3-A100 / 3')], nameOf)
    expect(groups.map(g => [g.label, g.entries.map(e => e.bggId)])).toEqual([['Hall 3', [1]]])
  })

  it('inside a hall, games with a booth come first by booth, then the hall-only ones by name', () => {
    const names = new Map([
      [1, 'Zoo'],
      [2, 'Apple'],
      [3, 'Mid'],
      [4, 'Brass'],
    ])
    const groups = groupByHall([entry(1, '3'), entry(2, '3'), entry(3, '3-R400'), entry(4, '3-A100')], e => names.get(e.bggId) ?? '')
    expect(groups[0]!.entries.map(e => e.bggId)).toEqual([4, 3, 2, 1])
  })

  it('"Hall foyer" is no booth: No booth yet', () => {
    const groups = groupByHall([entry(1, 'Hall foyer')], nameOf)
    expect(groups.map(g => g.label)).toEqual(['No booth yet'])
  })

  it('keeps Not interested games it is given (the screen passes the filtered games)', () => {
    const groups = groupByHall([{ ...entry(1, '3-R400'), mark: 'skip' }], nameOf)
    expect(groups.map(g => [g.label, g.entries.map(e => e.bggId)])).toEqual([['Hall 3', [1]]])
  })
})

describe('F005: inside a hall by category', () => {
  it('lists Must Have first and Not interested last, then by booth', () => {
    const names: Record<number, string> = { 1: 'Azul', 2: 'Brass', 3: 'Cascadia', 4: 'Dune' }
    const games = [
      { ...entry(1, '3-A100'), mark: 'skip' as const },
      { ...entry(2, '3-Z900'), mark: 'must_have' as const },
      { ...entry(3, '3-B200'), mark: 'interested' as const },
      { ...entry(4, '3-A050'), mark: 'must_have' as const },
    ]
    const [hall] = groupByHall(games, e => names[e.bggId] ?? '')
    expect(hall?.entries.map(e => names[e.bggId])).toEqual(['Dune', 'Brass', 'Cascadia', 'Azul'])
  })
})
