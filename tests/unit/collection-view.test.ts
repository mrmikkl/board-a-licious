import { describe, expect, it } from 'vitest'

import { type Entry, countMarks, groupByMark, markEntry, newEntry, removeEntry, showOffGames } from '../../src/domain/collection.ts'
import { MARKS } from '../../src/domain/marks.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const entry = (bggId: number, patch: Partial<Entry> = {}): Entry => ({ ...newEntry('c1', bggId, T1), ...patch })
const names: Record<number, string> = { 1: 'Cascadia', 2: 'Ark Nova', 3: 'Brass', 4: 'Azul', 5: 'Gone' }

describe('grouping a collection (FR-005)', () => {
  const entries = [
    entry(1, { mark: 'must_have' }),
    entry(2),
    entry(3, { mark: 'skip' }),
    entry(4, { mark: 'must_have' }),
    entry(5, { deleted: true }),
  ]

  it('groups in collection order: marked games first, then Not yet marked and Not interested (R5)', () => {
    const all = (['skip', 'new', 'poop', 'unsure', 'interested', 'must_have'] as const).map((mark, i) => entry(10 + i, { mark }))
    const groups = groupByMark(all, e => String(e.bggId))
    expect(groups.map(g => [g.mark.key, g.part])).toEqual([
      ['must_have', 'marked'],
      ['interested', 'marked'],
      ['unsure', 'marked'],
      ['poop', 'marked'],
      ['new', 'rest'],
      ['skip', 'rest'],
    ])
  })

  it('leaves out empty groups and deleted entries', () => {
    const groups = groupByMark(entries, e => names[e.bggId] ?? '')
    expect(groups.map(g => g.mark.key)).toEqual(['must_have', 'new', 'skip'])
    expect(groups[1]?.entries.map(e => e.bggId)).toEqual([2])
  })

  it('sorts games by name inside a group', () => {
    const groups = groupByMark(entries, e => names[e.bggId] ?? '')
    expect(groups[0]?.entries.map(e => names[e.bggId])).toEqual(['Azul', 'Cascadia'])
  })

  it('keeps MARKS in its own order, Not yet marked first, for pickers, filters and share text', () => {
    expect(MARKS.map(m => m.key)).toEqual(['new', 'must_have', 'interested', 'unsure', 'poop', 'skip'])
  })

  it('counts games per mark and bought (FR-002)', () => {
    const counts = countMarks([...entries, entry(6, { mark: 'interested', bought: true })])
    expect(counts.total).toBe(5)
    expect(counts.bought).toBe(1)
    expect(counts.byMark).toEqual({ new: 1, must_have: 2, interested: 1, unsure: 0, poop: 0, skip: 1 })
  })
})

describe('Show-off games (F004 FR-010)', () => {
  const entries = [
    entry(1, { mark: 'must_have' }),
    entry(2),
    entry(3, { mark: 'skip' }),
    entry(4, { mark: 'must_have' }),
    entry(5, { deleted: true, mark: 'must_have' }),
    entry(6, { mark: 'interested' }),
    entry(7, { mark: 'poop' }),
    entry(8, { mark: 'unsure' }),
  ]
  const nameOf = (e: Entry) => ({ ...names, 6: 'Dune', 7: 'Everdell', 8: 'Frosthaven' })[e.bggId] ?? ''

  it('keeps only live games of the chosen groups, in the collection group order, by name within a mark', () => {
    expect(showOffGames(entries, ['interested', 'must_have'], nameOf).map(e => e.bggId)).toEqual([4, 1, 6])
    expect(showOffGames(entries, ['skip', 'new', 'poop', 'unsure', 'interested', 'must_have'], nameOf).map(e => e.bggId)).toEqual([4, 1, 6, 8, 7, 2, 3])
  })

  it('is empty with no groups or groups without games', () => {
    expect(showOffGames(entries, [], nameOf)).toEqual([])
    expect(showOffGames([entry(2)], ['must_have'], nameOf)).toEqual([])
  })

  it('leaves deleted entries out', () => {
    expect(showOffGames(entries, ['must_have'], nameOf).map(e => e.bggId)).not.toContain(5)
  })
})

describe('changing an entry (FR-006)', () => {
  it('sets the mark and keeps bought and price', () => {
    const marked = markEntry(entry(1, { bought: true, paidCents: 5200, paidCurrency: 'EUR' }), 'must_have', T2)
    expect(marked).toMatchObject({ mark: 'must_have', bought: true, paidCents: 5200, updatedAt: T2 })
  })

  it('removes an entry as a tombstone', () => {
    expect(removeEntry(entry(1), T2)).toMatchObject({ deleted: true, updatedAt: T2 })
  })
})
