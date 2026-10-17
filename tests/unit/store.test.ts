import { afterEach, describe, expect, it } from 'vitest'

import { type Collection, newEntry } from '../../src/domain/collection.ts'
import { type Store, deleteStore, openStore } from '../../src/client/store.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const essen: Collection = { id: 'c1', name: 'Essen 2026', type: 'essen', updatedAt: T1, deleted: false }

const opened: Store[] = []
async function open(email = 'anna@example.com') {
  const store = await openStore(email)
  opened.push(store)
  return store
}
afterEach(async () => {
  for (const store of opened.splice(0)) {
    store.close()
    await deleteStore(store.email)
  }
})

describe('browser store', () => {
  it('keeps one database per signed-in person', async () => {
    const anna = await open('Anna@Example.com')
    const ben = await open('ben@example.com')
    await anna.saveCollection(essen)
    expect(await anna.collections()).toEqual([essen])
    expect(await ben.collections()).toEqual([])
    expect(anna.email).toBe('anna@example.com')
  })

  it('stores entries by [collectionId, bggId] and lists them per collection', async () => {
    const store = await open()
    await store.saveCollection(essen)
    await store.saveEntry(newEntry('c1', 1, T1))
    await store.saveEntry({ ...newEntry('c1', 1, T2), mark: 'must_have' })
    await store.saveEntry(newEntry('c2', 2, T1))
    expect((await store.entries('c1')).map(e => [e.bggId, e.mark])).toEqual([[1, 'must_have']])
    expect(await store.allEntries()).toHaveLength(2)
  })

  it('queues every local change in the outbox and acknowledges them', async () => {
    const store = await open()
    await store.saveCollection(essen)
    await store.saveEntry(newEntry('c1', 1, T1))
    const pending = await store.pending()
    expect(pending.map(p => p.kind)).toEqual(['collection', 'entry'])
    await store.acknowledge(pending.slice(0, 1).map(p => p.key))
    expect((await store.pending()).map(p => p.kind)).toEqual(['entry'])
  })

  it('applies remote rows with last-write-wins and without touching the outbox', async () => {
    const store = await open()
    await store.saveEntry({ ...newEntry('c1', 1, T2), mark: 'must_have' })
    await store.applyRemote({
      collections: [essen],
      entries: [{ ...newEntry('c1', 1, T1), mark: 'poop' }, newEntry('c1', 2, T1)],
    })
    expect((await store.entries('c1')).map(e => [e.bggId, e.mark])).toEqual([
      [1, 'must_have'],
      [2, 'new'],
    ])
    expect(await store.pending()).toHaveLength(1)
  })

  it('has stores for games, lists, publishers and meta', async () => {
    const store = await open()
    await store.putGames([{ bggId: 5, name: 'Cascadia', year: 2021, thumbnailUrl: null, description: null, kind: 'boardgame' }])
    expect((await store.game(5))?.name).toBe('Cascadia')
    await store.putList({ kind: 'preview', id: 93, title: 'SPIEL', isEssen: true, pageCount: 138, loadedPages: 1, entries: [], openedAt: T1 })
    expect((await store.list('preview', 93))?.pageCount).toBe(138)
    expect(await store.lists()).toHaveLength(1)
    await store.putPublishers({ 34183: 'Inside Up Games' })
    expect(await store.publishers([34183, 1])).toEqual({ 34183: 'Inside Up Games' })
    expect(await store.meta('soundOn')).toBeUndefined()
    await store.setMeta('soundOn', false)
    expect(await store.meta('soundOn')).toBe(false)
  })
})
