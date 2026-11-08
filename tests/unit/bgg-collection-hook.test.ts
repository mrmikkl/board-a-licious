import { describe, expect, it } from 'vitest'

import { GIVE_UP_MS, isFresh, nextCollection, nextRetry, statusMap } from '../../src/app/hooks/bgg-collection-state.ts'
import type { StoredBggCollection } from '../../src/client/types.ts'
import type { BggCollectionItem, Status } from '../../src/domain/bgg-status.ts'

const NOW = Date.parse('2026-11-08T18:00:00.000Z')
const minutes = (n: number) => new Date(NOW - n * 60_000).toISOString()
const status: Status = { own: true, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null }
const cascadia: BggCollectionItem = { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: null, kind: 'boardgame', status }
const stored: StoredBggCollection = { bggUser: 'mrmikkl', items: [cascadia], loadedAt: minutes(90), error: null }

describe('isFresh (FR-004)', () => {
  it('is fresh for less than an hour after loading', () => {
    expect(isFresh(minutes(0), NOW)).toBe(true)
    expect(isFresh(minutes(59), NOW)).toBe(true)
    expect(isFresh(minutes(60), NOW)).toBe(false)
    expect(isFresh(minutes(61), NOW)).toBe(false)
  })

  it('is never fresh without a load time', () => {
    expect(isFresh(null, NOW)).toBe(false)
    expect(isFresh(undefined, NOW)).toBe(false)
    expect(isFresh('not a time', NOW)).toBe(false)
  })
})

describe('nextRetry (FR-005)', () => {
  it('waits 5, 10, 20, 20 … seconds while BGG prepares the collection', () => {
    expect([1, 2, 3, 4, 5].map(attempt => nextRetry(attempt, NOW, NOW))).toEqual([5000, 10000, 20000, 20000, 20000])
  })

  it('gives up after about a minute', () => {
    expect(nextRetry(4, NOW - 35_000, NOW)).toBe(20000)
    expect(nextRetry(5, NOW - GIVE_UP_MS, NOW)).toBeNull()
    expect(GIVE_UP_MS).toBe(60_000)
  })
})

describe('nextCollection', () => {
  it('stores a loaded answer under the lower-cased user', () => {
    const answer = { bggUser: 'MrMikkl', loadedAt: minutes(0), items: [cascadia] }
    expect(nextCollection('MrMikkl', stored, { kind: 'loaded', answer }, NOW)).toEqual({ bggUser: 'mrmikkl', items: [cascadia], loadedAt: minutes(0), error: null })
  })

  it('records an unknown user with no games', () => {
    expect(nextCollection('nobody', undefined, { kind: 'not_found' }, NOW)).toEqual({ bggUser: 'nobody', items: [], loadedAt: minutes(0), error: 'not_found' })
  })

  it('keeps the stored copy and its time when offline or failing (FR-006)', () => {
    expect(nextCollection('mrmikkl', stored, { kind: 'offline' }, NOW)).toBe(stored)
    expect(nextCollection('mrmikkl', stored, { kind: 'failed' }, NOW)).toBe(stored)
    expect(nextCollection('mrmikkl', undefined, { kind: 'offline' }, NOW)).toBeUndefined()
  })
})

describe('statusMap', () => {
  it('maps BGG ids to statuses, empty without a collection', () => {
    expect(statusMap(stored)).toEqual(new Map([[295947, status]]))
    expect(statusMap(undefined)).toEqual(new Map())
  })
})
