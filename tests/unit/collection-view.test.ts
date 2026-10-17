import { describe, expect, it } from 'vitest'

import { type Entry, countMarks, groupByMark, markEntry, newEntry, removeEntry } from '../../src/domain/collection.ts'

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

  it('groups by mark in mark order, Not yet marked first, empty groups and deleted entries left out', () => {
    const groups = groupByMark(entries, e => names[e.bggId] ?? '')
    expect(groups.map(g => g.mark.key)).toEqual(['new', 'must_have', 'skip'])
    expect(groups[0]?.entries.map(e => e.bggId)).toEqual([2])
  })

  it('sorts games by name inside a group', () => {
    const groups = groupByMark(entries, e => names[e.bggId] ?? '')
    expect(groups[1]?.entries.map(e => names[e.bggId])).toEqual(['Azul', 'Cascadia'])
  })

  it('counts games per mark and bought (FR-002)', () => {
    const counts = countMarks([...entries, entry(6, { mark: 'interested', bought: true })])
    expect(counts.total).toBe(5)
    expect(counts.bought).toBe(1)
    expect(counts.byMark).toEqual({ new: 1, must_have: 2, interested: 1, unsure: 0, poop: 0, skip: 1 })
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
