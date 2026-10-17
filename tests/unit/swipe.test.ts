import { describe, expect, it } from 'vitest'

import { newEntry, removeEntry, validateEntry } from '../../src/domain/collection.ts'
import { swipeDecision, swipeQueue } from '../../src/domain/swipe.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'

const facts = { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisherId: 34183, publisher: 'Inside Up Games' }
const game = (position: number, bggId: number) => ({ position, bggId, name: `Game ${bggId}`, facts })
const list = (entries: ReturnType<typeof game>[], loadedPages = 1, pageCount = 1) => ({ isEssen: true, loadedPages, pageCount, entries })

const ids = (queue: { games: { bggId: number }[] }) => queue.games.map(g => g.bggId)

describe('swipe queue (FR-015)', () => {
  it('offers the games in list order', () => {
    const queue = swipeQueue(list([game(2, 20), game(3, 30), game(1, 10)]), [])
    expect(ids(queue)).toEqual([10, 20, 30])
    expect(queue).toMatchObject({ loadingMore: false, allDecided: false })
  })

  it('starts at the first undecided game and never offers games already in the collection, Not interested included', () => {
    const entries = [newEntry('c1', 10, T1), { ...newEntry('c1', 30, T1), mark: 'skip' as const }, { ...newEntry('c1', 40, T1), mark: 'must_have' as const }]
    expect(ids(swipeQueue(list([game(1, 10), game(2, 20), game(3, 30), game(4, 40), game(5, 50)]), entries))).toEqual([20, 50])
  })

  it('offers a game again once it was removed from the collection', () => {
    const removed = removeEntry(newEntry('c1', 10, T1), T2)
    expect(ids(swipeQueue(list([game(1, 10), game(2, 20)]), [removed]))).toEqual([10, 20])
  })

  it('offers a game listed twice only once', () => {
    expect(ids(swipeQueue(list([game(1, 10), game(2, 20), game(3, 10)]), []))).toEqual([10, 20])
  })

  it('offers the loaded games while later pages are still loading', () => {
    const queue = swipeQueue(list([game(1, 10), game(2, 20)], 1, 3), [newEntry('c1', 10, T1)])
    expect(ids(queue)).toEqual([20])
    expect(queue).toMatchObject({ loadingMore: true, allDecided: false })
  })

  it('is not all decided while pages are missing, even when every loaded game is decided', () => {
    const queue = swipeQueue(list([game(1, 10)], 1, 2), [newEntry('c1', 10, T1)])
    expect(queue).toEqual({ games: [], loadingMore: true, allDecided: false })
  })

  it('is all decided once every page is loaded and every game decided', () => {
    const queue = swipeQueue(list([game(1, 10), game(2, 20)], 2, 2), [newEntry('c1', 10, T1), { ...newEntry('c1', 20, T1), mark: 'skip' as const }])
    expect(queue).toEqual({ games: [], loadingMore: false, allDecided: true })
  })
})

describe('swipe decision (FR-015)', () => {
  const essen = { id: 'c1', type: 'essen' as const }

  it('right adds the game as Not yet marked', () => {
    const entry = swipeDecision({ collection: essen, game: game(1, 10), listIsEssen: true, direction: 'right', now: T1 })
    expect(entry).toMatchObject({ collectionId: 'c1', bggId: 10, mark: 'new', bought: false, deleted: false, updatedAt: T1 })
    expect(validateEntry(entry)).toBeNull()
  })

  it('left adds the game as Not interested', () => {
    const entry = swipeDecision({ collection: essen, game: game(1, 10), listIsEssen: true, direction: 'left', now: T1 })
    expect(entry).toMatchObject({ collectionId: 'c1', bggId: 10, mark: 'skip', deleted: false })
    expect(validateEntry(entry)).toBeNull()
  })

  it('keeps booth, price and publisher only from a preview into an Essen collection (FR-010)', () => {
    const kept = swipeDecision({ collection: essen, game: game(1, 10), listIsEssen: true, direction: 'right', now: T1 })
    expect(kept).toMatchObject({ facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games' }, factsSource: 'preview' })

    const standard = swipeDecision({ collection: { id: 'c2', type: 'standard' }, game: game(1, 10), listIsEssen: true, direction: 'left', now: T1 })
    expect(standard).toMatchObject({ facts: null, factsSource: null })

    const geeklist = swipeDecision({ collection: essen, game: { position: 1, bggId: 10 }, listIsEssen: false, direction: 'right', now: T1 })
    expect(geeklist).toMatchObject({ facts: null, factsSource: null })
  })

  it('marks the details as pending when the device has none yet', () => {
    const entry = swipeDecision({ collection: essen, game: game(1, 10), listIsEssen: true, direction: 'right', now: T1, detailsPending: true })
    expect(entry.detailsPending).toBe(true)
  })
})
