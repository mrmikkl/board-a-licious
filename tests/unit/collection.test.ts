import { describe, expect, it } from 'vitest'

import {
  type Collection,
  type Entry,
  deleteCollection,
  merge,
  newCollection,
  newEntry,
  renameCollection,
  validateCollection,
  validateEntry,
} from '../../src/domain/collection.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'

const essen: Collection = { id: 'c1', name: 'Essen 2026', type: 'essen', updatedAt: T1, deleted: false }
const entry = (patch: Partial<Entry> = {}): Entry => ({ ...newEntry('c1', 446453, T1), ...patch })

describe('collections', () => {
  it('trims the name and accepts 1–60 chars', () => {
    expect(newCollection({ id: 'x', name: '  Essen 2026 ', type: 'essen', now: T1 }).name).toBe('Essen 2026')
    expect(() => newCollection({ id: 'x', name: '   ', type: 'essen', now: T1 })).toThrow(/name/i)
    expect(() => newCollection({ id: 'x', name: 'x'.repeat(61), type: 'essen', now: T1 })).toThrow(/60/)
  })

  it('validates type essen | standard', () => {
    expect(validateCollection({ ...essen, type: 'standard' })).toBeNull()
    expect(validateCollection({ ...essen, type: 'other' as never })).toMatch(/type/i)
    expect(validateCollection({ ...essen, name: '' })).toMatch(/name/i)
  })

  it('renaming keeps the type and sets updatedAt', () => {
    const renamed = renameCollection(essen, ' Messe ', T2)
    expect(renamed).toEqual({ ...essen, name: 'Messe', updatedAt: T2 })
  })

  it('deleting a collection tombstones it and all its entries (FR-001a)', () => {
    const entries = [entry(), entry({ bggId: 2 }), { ...entry({ bggId: 3 }), collectionId: 'other' }]
    const result = deleteCollection(essen, entries, T2)
    expect(result.collection).toEqual({ ...essen, deleted: true, updatedAt: T2 })
    expect(result.entries.map(e => [e.bggId, e.deleted, e.updatedAt])).toEqual([
      [446453, true, T2],
      [2, true, T2],
    ])
  })
})

describe('entries', () => {
  it('start as Not yet marked, not bought, without facts', () => {
    expect(newEntry('c1', 5, T1)).toEqual({
      collectionId: 'c1',
      bggId: 5,
      mark: 'new',
      bought: false,
      paidCents: null,
      paidCurrency: null,
      facts: null,
      factsSource: null,
      detailsPending: false,
      updatedAt: T1,
      deleted: false,
    })
  })

  it('validates mark, bggId, prices and currency', () => {
    expect(validateEntry(entry())).toBeNull()
    expect(validateEntry(entry({ mark: 'loved' as never }))).toMatch(/mark/i)
    expect(validateEntry(entry({ bggId: 0 }))).toMatch(/bggId/)
    expect(validateEntry(entry({ paidCents: -1 }))).toMatch(/paid/i)
    expect(validateEntry(entry({ paidCents: 5200, paidCurrency: 'euro' }))).toMatch(/currency/i)
    expect(validateEntry(entry({ paidCents: null, paidCurrency: 'EUR' }))).toMatch(/currency/i)
    expect(validateEntry(entry({ facts: { priceCents: -5 } }))).toMatch(/price/i)
  })
})

describe('merge (last write wins)', () => {
  it('keeps the later updatedAt', () => {
    const local = entry({ mark: 'must_have', updatedAt: T2 })
    const server = entry({ mark: 'poop', updatedAt: T1 })
    expect(merge(local, server)).toBe(local)
    expect(merge({ ...local, updatedAt: T1 }, { ...server, updatedAt: T2 })).toEqual({ ...server, updatedAt: T2 })
  })

  it('takes the server copy on equal timestamps', () => {
    const local = entry({ mark: 'must_have' })
    const server = entry({ mark: 'poop' })
    expect(merge(local, server)).toBe(server)
  })

  it('syncs tombstones like changes', () => {
    const local = entry({ updatedAt: T1 })
    const removed = entry({ deleted: true, updatedAt: T2 })
    expect(merge(local, removed).deleted).toBe(true)
    expect(merge(undefined, removed)).toBe(removed)
  })
})
