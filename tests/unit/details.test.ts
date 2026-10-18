import { afterEach, describe, expect, it } from 'vitest'

import { ApiError } from '../../src/client/api.ts'
import { completeDetails } from '../../src/client/details.ts'
import { type Store, deleteStore, openStore } from '../../src/client/store.ts'
import type { Game } from '../../src/client/types.ts'
import { newEntry } from '../../src/domain/collection.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const cascadia: Game = { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: 'https://cf.geekdo-images.com/x.jpg', description: 'Tiles.', kind: 'boardgame', minPlayers: 1, maxPlayers: 4, designers: ['Randy Flynn'], mechanisms: ['Tile Placement'], publisher: 'Flatout Games' }

let store: Store
afterEach(async () => {
  store.close()
  await deleteStore(store.email)
})

const pendingEntry = () => ({ ...newEntry('c1', 295947, T1), detailsPending: true, mark: 'must_have' as const, bought: true, paidCents: 5200, paidCurrency: 'EUR' })

describe('completing link-added games (FR-017)', () => {
  it('fetches games again once that were stored before players, designers and mechanisms existed', async () => {
    store = await openStore('anna@example.com')
    const { minPlayers: _a, maxPlayers: _b, designers: _c, mechanisms: _d, publisher: _e, ...old } = cascadia
    await store.putGames([old])
    await store.saveEntry({ ...newEntry('c1', 295947, T1), mark: 'must_have' as const })
    const asked: number[][] = []
    const api = { games: async (ids: number[]) => (asked.push(ids), [cascadia]) }
    await completeDetails({ store, api, now: () => T2 })
    expect(asked).toEqual([[295947]])
    expect(await store.game(295947)).toEqual(cascadia)
    await completeDetails({ store, api, now: () => T2 })
    expect(asked).toHaveLength(1)
    await store.putGames([{ ...cascadia, designers: '["Randy Flynn"]' as never }])
    await completeDetails({ store, api, now: () => T2 })
    expect(asked).toHaveLength(2)
    expect((await store.entries('c1'))[0]).toMatchObject({ mark: 'must_have', updatedAt: T1 })
  })

  it('fills in name, year, cover and description and keeps mark, bought and price', async () => {
    store = await openStore('anna@example.com')
    await store.putGames([{ ...cascadia, name: 'Cascadia (from link)', year: null, thumbnailUrl: null, description: null }])
    await store.saveEntry(pendingEntry())
    const asked: number[][] = []
    const api = { games: async (ids: number[]) => (asked.push(ids), [cascadia]) }

    expect(await completeDetails({ store, api, now: () => T2 })).toBe(1)
    expect(asked).toEqual([[295947]])
    expect(await store.game(295947)).toEqual(cascadia)
    const [entry] = await store.entries('c1')
    expect(entry).toMatchObject({ detailsPending: false, mark: 'must_have', bought: true, paidCents: 5200, paidCurrency: 'EUR', updatedAt: T2 })
  })

  it('keeps the entry pending when BGG fails, for the next try', async () => {
    store = await openStore('anna@example.com')
    await store.saveEntry(pendingEntry())
    const api = { games: async () => Promise.reject(new ApiError('bgg_unavailable', 'down', true)) }
    expect(await completeDetails({ store, api, now: () => T2 })).toBe(0)
    expect((await store.entries('c1'))[0]?.detailsPending).toBe(true)
  })

  it('keeps entries pending that BGG did not return', async () => {
    store = await openStore('anna@example.com')
    await store.saveEntry(pendingEntry())
    expect(await completeDetails({ store, api: { games: async () => [] }, now: () => T2 })).toBe(0)
    expect((await store.entries('c1'))[0]?.detailsPending).toBe(true)
  })

  it('ignores deleted entries and asks for at most 50 ids at a time', async () => {
    store = await openStore('anna@example.com')
    for (let id = 1; id <= 60; id++) await store.saveEntry({ ...newEntry('c1', id, T1), detailsPending: true })
    await store.saveEntry({ ...newEntry('c1', 61, T1), detailsPending: true, deleted: true })
    const asked: number[][] = []
    await completeDetails({ store, api: { games: async ids => (asked.push(ids), []) }, now: () => T2 })
    expect(asked.map(ids => ids.length)).toEqual([50, 10])
    expect(asked.flat()).not.toContain(61)
  })

  it('never loses a mark made while it completes the details (no lost update)', async () => {
    store = await openStore('anna@example.com')
    for (let round = 0; round < 25; round++) {
      const id = 1000 + round
      await store.saveEntry({ ...newEntry('c1', id, T1), detailsPending: true })
      const api = { games: async (ids: number[]) => ids.map(bggId => ({ ...cascadia, bggId })) }
      // the person marks the game while BGG's answer is being stored
      await Promise.all([
        completeDetails({ store, api, now: () => T2 }),
        (async () => {
          for (let i = 0; i < round % 5; i++) await Promise.resolve()
          const [current] = (await store.entries('c1')).filter(e => e.bggId === id)
          await store.saveEntry({ ...current!, mark: 'must_have', updatedAt: '2026-10-17T11:00:00.000Z' })
        })(),
      ])
      const [after] = (await store.entries('c1')).filter(e => e.bggId === id)
      expect(after?.mark, `round ${round}`).toBe('must_have')
    }
  })
})
