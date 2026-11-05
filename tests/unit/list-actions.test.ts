import { afterEach, describe, expect, it } from 'vitest'

import { type Store, deleteStore, openStore } from '../../src/client/store.ts'
import type { StoredList, StoredListEntry } from '../../src/client/types.ts'
import type { AppServices } from '../../src/app/context.tsx'
import { applyMembership } from '../../src/app/list-actions.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const preview: StoredList = { kind: 'preview', id: 93, title: 'SPIEL', pageCount: 1, loadedPages: 1, entries: [], openedAt: T1 }
const item: StoredListEntry = {
  position: 1,
  bggId: 446453,
  name: 'Kalypso',
  thumbnailUrl: 'https://cf.geekdo-images.com/k.jpg',
  facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', publisherId: 34183 },
}

let store: Store
afterEach(async () => {
  store.close()
  await deleteStore(store.email)
})

async function setup() {
  store = await openStore('anna@example.com')
  await store.saveCollection({ id: 'essen', name: 'Essen 2026', updatedAt: T1, deleted: false })
  const calls = { schedule: 0, details: 0 }
  const services = {
    store,
    sync: { schedule: async () => void calls.schedule++ },
    completeDetails: async () => void calls.details++,
  } as unknown as AppServices
  return { services, calls }
}

describe('applyMembership (list game sheet, Done)', () => {
  it('adds with facts, stores the list name and cover as a stand-in and asks BGG for details', async () => {
    const { services, calls } = await setup()
    expect(await applyMembership(services, preview, item, new Set(), new Set(['essen']))).toEqual({ added: 1, removed: 0 })
    const [entry] = await store.entries('essen')
    expect(entry).toMatchObject({ bggId: 446453, mark: 'new', detailsPending: true, factsSource: 'preview', facts: { booth: '3-R400' } })
    expect(await store.game(446453)).toMatchObject({ name: 'Kalypso', thumbnailUrl: item.thumbnailUrl, year: null })
    expect(calls).toEqual({ schedule: 1, details: 1 })
  })

  it('F005: puts newly added games into the chosen category, leaving games already there alone', async () => {
    const { services } = await setup()
    await applyMembership(services, preview, item, new Set(), new Set(['essen']), 'later')
    expect((await store.entries('essen'))[0]?.mark).toBe('later')
  })

  it('does not mark the entry pending when the device already has the details', async () => {
    const { services, calls } = await setup()
    await store.putGames([{ bggId: 446453, name: 'Kalypso', year: 2026, thumbnailUrl: null, description: 'A game.', kind: 'boardgame' }])
    await applyMembership(services, preview, item, new Set(), new Set(['essen']))
    expect((await store.entries('essen'))[0]?.detailsPending).toBe(false)
    expect((await store.game(446453))?.year).toBe(2026)
    expect(calls.details).toBe(0)
  })

  it('does nothing when the ticks did not change', async () => {
    const { services, calls } = await setup()
    expect(await applyMembership(services, preview, item, new Set(), new Set())).toEqual({ added: 0, removed: 0 })
    expect(await store.allEntries()).toEqual([])
    expect(calls).toEqual({ schedule: 0, details: 0 })
  })
})
