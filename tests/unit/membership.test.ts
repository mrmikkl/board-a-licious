import { describe, expect, it } from 'vitest'

import { type Collection, type Entry, newEntry } from '../../src/domain/collection.ts'
import { memberships, membershipChanges } from '../../src/domain/membership.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'

const essen: Collection = { id: 'essen', name: 'Essen 2026', updatedAt: T1, deleted: false }
const home: Collection = { id: 'home', name: 'Home', updatedAt: T1, deleted: false }
const later: Collection = { id: 'later', name: 'Later', updatedAt: T1, deleted: false }
const collections = [essen, home, later]

const GAME = 446453
const facts = { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisherId: 34183, publisher: 'Inside Up Games' }
const bought: Entry = { ...newEntry('home', GAME, T1), mark: 'must_have', bought: true, paidCents: 5200, paidCurrency: 'EUR' }

const change = (before: string[], after: string[], entries: Entry[] = []) =>
  membershipChanges({ bggId: GAME, before: new Set(before), after: new Set(after), collections, entries, facts, now: T2 })

describe('membership (FR-014)', () => {
  it('reads the collections a game is in, ignoring removed entries and other games', () => {
    const entries = [bought, { ...newEntry('later', GAME, T1), deleted: true }, newEntry('essen', 1, T1)]
    expect(memberships(entries, GAME)).toEqual(new Set(['home']))
  })

  it('changes nothing when nothing changed', () => {
    expect(change(['home'], ['home'], [bought])).toEqual({ adds: [], removals: [] })
  })

  it('adds new entries for ticked collections, each with the facts of the list (FR-010)', () => {
    const { adds, removals } = change([], ['essen', 'home'])
    expect(removals).toEqual([])
    expect(adds).toEqual([{ ...newEntry('essen', GAME, T2), facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', edition: null }, factsSource: 'preview' }, { ...newEntry('home', GAME, T2), facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', edition: null }, factsSource: 'preview' }])
  })

  it('adds from a geeklist without facts', () => {
    expect(membershipChanges({ bggId: GAME, before: new Set(), after: new Set(['essen']), collections, entries: [], now: T2 }).adds).toEqual([
      newEntry('essen', GAME, T2),
    ])
  })

  it('removes unticked collections as tombstones, mark, bought and price included', () => {
    const { adds, removals } = change(['home'], [], [bought])
    expect(adds).toEqual([])
    expect(removals).toEqual([{ ...bought, deleted: true, updatedAt: T2 }])
  })

  it('re-adding after a removal starts fresh', () => {
    const tombstone = { ...bought, deleted: true }
    expect(change([], ['home'], [tombstone]).adds).toEqual([
      { ...newEntry('home', GAME, T2), facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', edition: null }, factsSource: 'preview' },
    ])
  })

  it('adds and removes in one choice', () => {
    const { adds, removals } = change(['home'], ['later'], [bought])
    expect(adds.map(e => e.collectionId)).toEqual(['later'])
    expect(removals.map(e => [e.collectionId, e.deleted])).toEqual([['home', true]])
  })

  it('ignores unknown or deleted collections', () => {
    const gone = { ...later, deleted: true }
    const result = membershipChanges({
      bggId: GAME,
      before: new Set(),
      after: new Set(['later', 'nope']),
      collections: [essen, home, gone],
      entries: [],
      now: T2,
    })
    expect(result).toEqual({ adds: [], removals: [] })
  })
})
