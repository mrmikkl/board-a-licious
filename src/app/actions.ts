import {
  type Collection,
  type Entry,
  type Facts,
  type Paid,
  deleteCollection as tombstoneCollection,
  markBought,
  markEntry,
  newCollection,
  newEntry,
  removeEntry,
  renameCollection as renamed,
  unmarkBought,
} from '../domain/collection.ts'
import { setManualFacts } from '../domain/facts.ts'
import { type Filter, toStored } from '../domain/filter.ts'
import { copyEntry, moveEntry } from '../domain/membership.ts'
import type { Mark } from '../domain/marks.ts'
import { type Point, celebrate } from './celebrate.ts'
import type { AppServices } from './context.tsx'

/** Local changes: saved on the device (with the outbox), then a sync is scheduled. */
const now = () => new Date().toISOString()

export async function createCollection(services: AppServices, name: string): Promise<Collection> {
  const collection = newCollection({ id: crypto.randomUUID(), name, now: now() })
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
export async function addGameByLink(services: AppServices, collectionId: string, bggId: number, name: string, mark: Mark = 'new') {
  const { store } = services
  if (!(await store.game(bggId))) {
    await store.putGames([{ bggId, name: name.trim(), year: null, thumbnailUrl: null, description: null, kind: 'boardgame' }])
  }
  // a removed game (tombstone) comes back fresh, in the category chosen in the sheet (F005; default No category yet)
  await store.saveEntry({ ...newEntry(collectionId, bggId, now()), mark, detailsPending: true })
  void services.sync.schedule()
  void services.completeDetails()
}

/** `from`: where the tapped button is, for the Must Have burst (screen centre otherwise). */
export async function setMark(services: AppServices, entry: Entry, mark: Mark, from?: Point) {
  // sound first, while the tap still counts as a user gesture for Web Audio
  services.feedback.mark(mark)
  if (mark === 'must_have' && entry.mark !== 'must_have') celebrate({ kind: 'must_have', from })
  await services.store.saveEntry(markEntry(entry, mark, now()))
  void services.sync.schedule()
}

export async function removeGame(services: AppServices, entry: Entry) {
  await services.store.saveEntry(removeEntry(entry, now()))
  void services.sync.schedule()
}

/** Bought with the price paid, or without one (FR-007). */
export async function buyGame(services: AppServices, entry: Entry, paid: Paid | null, from?: Point) {
  // chime first, while the tap still counts as a user gesture for Web Audio
  services.feedback.bought()
  celebrate({ kind: 'bought', from })
  await services.store.saveEntry(markBought(entry, paid, now()))
  void services.sync.schedule()
}

export async function unbuyGame(services: AppServices, entry: Entry) {
  await services.store.saveEntry(unmarkBought(entry, now()))
  void services.sync.schedule()
}

/** F005 R11: the game also goes into `targetId`, with its category and facts, but not as bought. */
export async function copyGameTo(services: AppServices, entry: Entry, targetId: string) {
  const target = (await services.store.entries(targetId)).find(e => e.bggId === entry.bggId)
  await services.store.saveEntry(copyEntry(entry, targetId, now(), target))
  void services.sync.schedule()
}

/** F005 R11: the game moves to `targetId` with everything it has; the source is removed. */
export async function moveGameTo(services: AppServices, entry: Entry, targetId: string) {
  const target = (await services.store.entries(targetId)).find(e => e.bggId === entry.bggId)
  await services.store.saveEntries(moveEntry(entry, targetId, now(), target))
  void services.sync.schedule()
}

/** Booth, price and publisher typed in by hand (FR-011). */
export async function saveFacts(services: AppServices, entry: Entry, facts: Facts) {
  await services.store.saveEntry(setManualFacts(entry, facts, now()))
  void services.sync.schedule()
}

/** The filter is remembered per collection on this device, also after closing the app (FR-009). */
export async function saveFilter(services: AppServices, collectionId: string, filter: Filter) {
  const all = (await services.store.meta('activeFilter')) ?? {}
  await services.store.setMeta('activeFilter', { ...all, [collectionId]: toStored(filter) })
}

/** "Group by" (marks or booth/hall) is remembered per collection on this device, like the filter. */
export async function saveGroupBy(services: AppServices, collectionId: string, groupBy: 'mark' | 'booth') {
  const all = (await services.store.meta('groupBy')) ?? {}
  await services.store.setMeta('groupBy', { ...all, [collectionId]: groupBy })
}
