import {
  type Collection,
  type CollectionType,
  type Entry,
  deleteCollection as tombstoneCollection,
  markEntry,
  newCollection,
  newEntry,
  removeEntry,
  renameCollection as renamed,
} from '../domain/collection.ts'
import type { Mark } from '../domain/marks.ts'
import type { AppServices } from './context.tsx'

/** Local changes: saved on the device (with the outbox), then a sync is scheduled. */
const now = () => new Date().toISOString()

export async function createCollection(services: AppServices, name: string, type: CollectionType): Promise<Collection> {
  const collection = newCollection({ id: crypto.randomUUID(), name, type, now: now() })
  await services.store.saveCollection(collection)
  void services.sync.schedule()
  return collection
}

export async function renameCollection(services: AppServices, collection: Collection, name: string) {
  await services.store.saveCollection(renamed(collection, name, now()))
  void services.sync.schedule()
}

/** Tombstones the collection and all its entries (FR-001a). */
export async function deleteCollection(services: AppServices, collection: Collection) {
  const { collection: gone, entries } = tombstoneCollection(collection, await services.store.entries(collection.id), now())
  await services.store.saveCollection(gone)
  if (entries.length > 0) await services.store.saveEntries(entries)
  void services.sync.schedule()
}

/**
 * Adds a game by its link (FR-016). Until BGG details arrive the typed name stands in for the game on
 * this device; the entry is marked `detailsPending` and completed in the background (FR-017).
 */
export async function addGameByLink(services: AppServices, collectionId: string, bggId: number, name: string) {
  const { store } = services
  if (!(await store.game(bggId))) {
    await store.putGames([{ bggId, name: name.trim(), year: null, thumbnailUrl: null, description: null, kind: 'boardgame' }])
  }
  // a removed game (tombstone) comes back fresh, as "Not yet marked"
  await store.saveEntry({ ...newEntry(collectionId, bggId, now()), detailsPending: true })
  void services.sync.schedule()
  void services.completeDetails()
}

export async function setMark(services: AppServices, entry: Entry, mark: Mark) {
  await services.store.saveEntry(markEntry(entry, mark, now()))
  void services.sync.schedule()
}

export async function removeGame(services: AppServices, entry: Entry) {
  await services.store.saveEntry(removeEntry(entry, now()))
  void services.sync.schedule()
}
