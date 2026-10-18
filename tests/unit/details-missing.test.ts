import { afterEach, describe, expect, it } from 'vitest'

import { completeDetails } from '../../src/client/details.ts'
import { type Store, deleteStore, openStore } from '../../src/client/store.ts'
import type { Game } from '../../src/client/types.ts'
import { newEntry } from '../../src/domain/collection.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const cascadia: Game = { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: null, description: null, kind: 'boardgame' }

let store: Store
afterEach(async () => {
  store.close()
  await deleteStore(store.email)
})

describe('games synced from another device', () => {
  it('fetches games this device does not know yet, without touching their entries', async () => {
    store = await openStore('ben@example.com')
    await store.applyRemote({ collections: [], entries: [{ ...newEntry('c1', 295947, T1), mark: 'poop' }] })
    await store.applyRemote({ collections: [], entries: [newEntry('c1', 1, T1)] })
    await store.putGames([{ ...cascadia, bggId: 1, name: 'Known', designers: [] }])
    const asked: number[][] = []

    expect(await completeDetails({ store, api: { games: async ids => (asked.push(ids), [cascadia]) }, now: () => T1 })).toBe(0)
    expect(asked).toEqual([[295947]])
    expect(await store.game(295947)).toEqual(cascadia)
    expect(await store.pending()).toEqual([])
  })
})
