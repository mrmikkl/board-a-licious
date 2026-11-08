import { afterEach, describe, expect, it } from 'vitest'

import { type Collection, newEntry } from '../../src/domain/collection.ts'
import { type Store, deleteStore, openStore } from '../../src/client/store.ts'
import { DEFAULT_BADGE_COLOURS, type Status } from '../../src/domain/bgg-status.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const essen: Collection = { id: 'c1', name: 'Essen 2026', updatedAt: T1, deleted: false }

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
    await store.putList({ kind: 'preview', id: 93, title: 'SPIEL', pageCount: 138, loadedPages: 1, entries: [], openedAt: T1 })
    expect((await store.list('preview', 93))?.pageCount).toBe(138)
    expect(await store.lists()).toHaveLength(1)
    await store.putPublishers({ 34183: 'Inside Up Games' })
    expect(await store.publishers([34183, 1])).toEqual({ 34183: 'Inside Up Games' })
    expect(await store.meta('soundOn')).toBeUndefined()
    await store.setMeta('soundOn', false)
    expect(await store.meta('soundOn')).toBe(false)
    // F007: the price language choice, remembered on the device
    expect(await store.meta('priceLanguage')).toBeUndefined()
    await store.setMeta('priceLanguage', 'de')
    expect(await store.meta('priceLanguage')).toBe('de')
  })

  it('F008: keeps BGG collections per lower-cased BGG user', async () => {
    const store = await open()
    const status: Status = { own: true, prevOwned: false, forTrade: false, wantInTrade: false, wantToBuy: false, wantToPlay: false, preordered: false, wishlist: null }
    const item = { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: null, kind: 'boardgame' as const, status }
    expect(await store.bggCollection('mrmikkl')).toBeUndefined()
    await store.putBggCollection({ bggUser: 'MrMikkl', items: [item], loadedAt: T1, error: null })
    expect(await store.bggCollection('mrMIKKL')).toEqual({ bggUser: 'mrmikkl', items: [item], loadedAt: T1, error: null })
    await store.putBggCollection({ bggUser: 'nobody', items: [], loadedAt: T2, error: 'not_found' })
    expect((await store.bggCollections()).map(c => c.bggUser).sort()).toEqual(['mrmikkl', 'nobody'])
    // device data: never queued for the server
    expect(await store.pending()).toEqual([])
  })

  it('F008: has device meta with defaults for badge colours, last tabs and the BGG sign-in hint', async () => {
    const store = await open()
    expect(await store.metaOrDefault('badgeColours')).toEqual(DEFAULT_BADGE_COLOURS)
    expect(await store.metaOrDefault('lastTab')).toEqual({ buy: 'search', lists: 'status' })
    expect(await store.metaOrDefault('bggSignedInAs')).toBeNull()
    await store.setMeta('badgeColours', { ...DEFAULT_BADGE_COLOURS, own: 'red' })
    await store.setMeta('lastTab', { buy: 'shopping', lists: 'geeklists' })
    await store.setMeta('bggSignedInAs', 'mrmikkl')
    expect((await store.metaOrDefault('badgeColours')).own).toBe('red')
    expect(await store.metaOrDefault('lastTab')).toEqual({ buy: 'shopping', lists: 'geeklists' })
    expect(await store.metaOrDefault('bggSignedInAs')).toBe('mrmikkl')
  })

  it('F008: sets the BGG username and follows, queued as setting and follow changes', async () => {
    const store = await open()
    expect(await store.bggUsername()).toBeNull()
    await store.setBggUsername(' mrmikkl ', T1)
    expect(await store.bggUsername()).toBe('mrmikkl')
    await store.setBggUsername('', T2)
    expect(await store.bggUsername()).toBeNull()
    await store.follow('Anna_Meeple', T1)
    await store.follow('ben', T1)
    await store.unfollow('BEN', T2)
    expect(await store.follows()).toEqual(['anna_meeple'])
    expect((await store.pending()).map(p => [p.kind, p.row])).toEqual([
      ['setting', { bggUsername: 'mrmikkl', updatedAt: T1 }],
      ['setting', { bggUsername: null, updatedAt: T2 }],
      ['follow', { bggUser: 'anna_meeple', updatedAt: T1, deleted: false }],
      ['follow', { bggUser: 'ben', updatedAt: T1, deleted: false }],
      ['follow', { bggUser: 'ben', updatedAt: T2, deleted: true }],
    ])
  })

  it('F008: merges pulled settings and follows last-write-wins, tombstones included', async () => {
    const store = await open()
    await store.setBggUsername('mine', T2)
    await store.follow('anna', T2)
    await store.applyRemote({
      collections: [],
      entries: [],
      settings: [{ bggUsername: 'older', updatedAt: T1 }],
      follows: [
        { bggUser: 'anna', updatedAt: T1, deleted: true },
        { bggUser: 'Ben', updatedAt: T1, deleted: false },
        { bggUser: 'carl', updatedAt: T1, deleted: true },
      ],
    })
    expect(await store.bggUsername()).toBe('mine')
    expect(await store.follows()).toEqual(['anna', 'ben'])
    await store.applyRemote({
      collections: [],
      entries: [],
      settings: [{ bggUsername: 'newer', updatedAt: '2026-10-17T11:00:00.000Z' }],
      follows: [{ bggUser: 'anna', updatedAt: '2026-10-17T11:00:00.000Z', deleted: true }],
    })
    expect(await store.bggUsername()).toBe('newer')
    expect(await store.follows()).toEqual(['ben'])
    // only the two local changes are queued, nothing from the server
    expect(await store.pending()).toHaveLength(2)
  })

  it('F008: keeps the data of a version 1 database when it is upgraded', async () => {
    const { openDB } = await import('idb')
    const name = 'board-a-licious-old@example.com'
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('collections', { keyPath: 'id' })
        db.createObjectStore('entries', { keyPath: ['collectionId', 'bggId'] }).createIndex('byCollection', 'collectionId')
        db.createObjectStore('outbox', { autoIncrement: true })
        db.createObjectStore('games', { keyPath: 'bggId' })
        db.createObjectStore('lists', { keyPath: ['kind', 'id'] })
        db.createObjectStore('publishers', { keyPath: 'companyId' })
        db.createObjectStore('meta')
      },
    })
    await old.put('collections', essen)
    await old.put('meta', false, 'soundOn')
    old.close()
    const store = await open('old@example.com')
    expect(await store.collections()).toEqual([essen])
    expect(await store.meta('soundOn')).toBe(false)
    expect(await store.bggCollections()).toEqual([])
    expect(await store.follows()).toEqual([])
  })
})
