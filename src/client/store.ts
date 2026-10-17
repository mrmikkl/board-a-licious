import { type DBSchema, type IDBPDatabase, deleteDB, openDB } from 'idb'

import { type Collection, type Entry, entryKey, merge } from '../domain/collection.ts'
import type { LoadedList } from '../domain/lists.ts'
import type { Game, ListKind, StoredList } from './types.ts'

export type Change = { kind: 'collection'; row: Collection } | { kind: 'entry'; row: Entry } | { kind: 'list'; row: LoadedList }
export type PendingChange = Change & { key: number }

export type MetaValues = {
  lastSyncAt: string
  userEmail: string
  soundOn: boolean
  activeFilter: Record<string, unknown>
}

interface Schema extends DBSchema {
  collections: { key: string; value: Collection }
  entries: { key: [string, number]; value: Entry; indexes: { byCollection: string } }
  outbox: { key: number; value: Change }
  games: { key: number; value: Game }
  lists: { key: [ListKind, number]; value: StoredList }
  publishers: { key: number; value: { companyId: number; name: string } }
  meta: { key: string; value: unknown }
}

const dbName = (email: string) => `board-a-licious-${email.toLowerCase()}`

export async function deleteStore(email: string) {
  await deleteDB(dbName(email))
}

/** One IndexedDB database per signed-in person (data-model.md), so people sharing a phone stay apart. */
export async function openStore(rawEmail: string) {
  const email = rawEmail.toLowerCase()
  const db: IDBPDatabase<Schema> = await openDB<Schema>(dbName(email), 1, {
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

  const listeners = new Set<() => void>()
  const changed = () => listeners.forEach(listener => listener())

  return {
    email,
    close: () => db.close(),
    /** Called after every write, local or remote; the UI re-reads on it. */
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },

    async collections(): Promise<Collection[]> {
      return db.getAll('collections')
    },
    async entries(collectionId: string): Promise<Entry[]> {
      return db.getAllFromIndex('entries', 'byCollection', collectionId)
    },
    async allEntries(): Promise<Entry[]> {
      return db.getAll('entries')
    },

    /** A local change: stored and queued for the server in one transaction. */
    async saveCollection(row: Collection) {
      const tx = db.transaction(['collections', 'outbox'], 'readwrite')
      await Promise.all([tx.objectStore('collections').put(row), tx.objectStore('outbox').add({ kind: 'collection', row }), tx.done])
      changed()
    },
    async saveEntry(row: Entry) {
      await this.saveEntries([row])
    },
    async saveEntries(rows: Entry[]) {
      const tx = db.transaction(['entries', 'outbox'], 'readwrite')
      for (const row of rows) {
        void tx.objectStore('entries').put(row)
        void tx.objectStore('outbox').add({ kind: 'entry', row })
      }
      await tx.done
      changed()
    },

    /** A list loaded on this device, queued so the person's other devices show it too. */
    async saveListRef(row: LoadedList) {
      await db.add('outbox', { kind: 'list', row })
    },

    async pending(): Promise<PendingChange[]> {
      const tx = db.transaction('outbox')
      const out: PendingChange[] = []
      for (let cursor = await tx.store.openCursor(); cursor; cursor = await cursor.continue()) {
        out.push({ ...cursor.value, key: cursor.key })
      }
      return out
    },
    async acknowledge(keys: number[]) {
      const tx = db.transaction('outbox', 'readwrite')
      for (const key of keys) void tx.store.delete(key)
      await tx.done
    },

    /** Rows from the server, merged last-write-wins; not queued again. */
    async applyRemote(changes: { collections: Collection[]; entries: Entry[]; lists?: LoadedList[] }) {
      const tx = db.transaction(['collections', 'entries', 'lists'], 'readwrite')
      const collections = tx.objectStore('collections')
      const entries = tx.objectStore('entries')
      for (const remote of changes.collections) void collections.put(merge(await collections.get(remote.id), remote))
      for (const remote of changes.entries) {
        void entries.put(merge(await entries.get([remote.collectionId, remote.bggId]), remote))
      }
      // lists loaded on another device appear here, empty, and load their games when opened
      const lists = tx.objectStore('lists')
      for (const ref of changes.lists ?? []) {
        if (ref.deleted || (await lists.get([ref.kind, ref.id]))) continue
        void lists.put({ kind: ref.kind, id: ref.id, title: ref.title, isEssen: ref.isEssen, pageCount: 0, loadedPages: 0, entries: [], openedAt: ref.updatedAt })
      }
      await tx.done
      changed()
    },

    async game(bggId: number) {
      return db.get('games', bggId)
    },
    async games(ids: number[]) {
      const found = await Promise.all(ids.map(id => db.get('games', id)))
      return found.filter((g): g is Game => g !== undefined)
    },
    async putGames(games: Game[]) {
      const tx = db.transaction('games', 'readwrite')
      for (const game of games) void tx.store.put(game)
      await tx.done
      changed()
    },

    async list(kind: ListKind, id: number) {
      return db.get('lists', [kind, id])
    },
    async lists() {
      return db.getAll('lists')
    },
    async putList(list: StoredList) {
      await db.put('lists', list)
      changed()
    },
    async deleteList(kind: ListKind, id: number) {
      await db.delete('lists', [kind, id])
      changed()
    },

    async publishers(ids: number[]): Promise<Record<number, string>> {
      const out: Record<number, string> = {}
      for (const id of ids) {
        const row = await db.get('publishers', id)
        if (row) out[id] = row.name
      }
      return out
    },
    async putPublishers(names: Record<number, string>) {
      const tx = db.transaction('publishers', 'readwrite')
      for (const [id, name] of Object.entries(names)) void tx.store.put({ companyId: Number(id), name })
      await tx.done
      changed()
    },

    async meta<K extends keyof MetaValues>(key: K): Promise<MetaValues[K] | undefined> {
      return (await db.get('meta', key)) as MetaValues[K] | undefined
    },
    async setMeta<K extends keyof MetaValues>(key: K, value: MetaValues[K]) {
      await db.put('meta', value, key)
      changed()
    },
  }
}

export type Store = Awaited<ReturnType<typeof openStore>>
export { entryKey }
