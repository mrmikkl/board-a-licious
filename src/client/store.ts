import { type DBSchema, type IDBPDatabase, deleteDB, openDB } from 'idb'

import { DEFAULT_BADGE_COLOURS, type PaletteName, type StatusKey } from '../domain/bgg-status.ts'
import { type Collection, type Entry, entryKey, merge } from '../domain/collection.ts'
import { DEFAULT_LENGTH_LIMITS, type LengthLimits, type StoredGameFilter, validLengthLimits } from '../domain/game-filter.ts'
import type { LoadedList } from '../domain/lists.ts'
import type { Mark } from '../domain/marks.ts'
import type { PriceLanguage } from '../domain/offers.ts'
import type { FollowedBggUser, Game, ListKind, StoredBggCollection, StoredList, UserSetting } from './types.ts'

export type Change =
  | { kind: 'collection'; row: Collection }
  | { kind: 'entry'; row: Entry }
  | { kind: 'list'; row: LoadedList }
  | { kind: 'setting'; row: UserSetting }
  | { kind: 'follow'; row: FollowedBggUser }
export type PendingChange = Change & { key: number }

export type MetaValues = {
  lastSyncAt: string
  userEmail: string
  soundOn: boolean
  activeFilter: Record<string, unknown>
  /** How each collection's games are grouped: by mark (default) or by fair hall. */
  groupBy: Record<string, 'mark' | 'booth'>
  /** F002: the collection a game was last shared into on this device (preselected in the share sheet). */
  lastShareCollection: string
  /** F004: the groups last shown off per collection (data-model "Show-off choice"); missing → Must Have. */
  showOff: Record<string, Mark[]>
  /** US5: the BGG value a hand-typed field was kept against, per `collectionId:bggId:field`. */
  declinedFacts: Record<string, string>
  /** F007: the editions the price lists show (Both, English, German); missing → both. */
  priceLanguage: PriceLanguage
  /** F008: the person's BGG username with its time, synced through the outbox (use `bggUsername()`). */
  bggSetting: UserSetting
  /** F008: badge colour per BGG status. */
  badgeColours: Record<StatusKey, PaletteName>
  /** F008: the tab last open in Buy and in Lists. */
  lastTab: { buy: 'search' | 'shopping'; lists: 'status' | 'previews' | 'geeklists' | 'search' }
  /** F008: who is signed in to BGG, a hint for the UI only (the cookie decides). */
  bggSignedInAs: string | null
  /** F009: the filter of each BGG list on this device, by list key (`status:<bggUser lower>:<status>`, `preview:<id>`, `geeklist:<id>`). */
  listFilters: Record<string, StoredGameFilter>
}

/** F008: device meta that has a default (data-model.md "Device meta"). */
const META_DEFAULTS = {
  badgeColours: DEFAULT_BADGE_COLOURS,
  lastTab: { buy: 'search', lists: 'status' },
  bggSignedInAs: null,
} satisfies Partial<MetaValues>
type MetaWithDefault = keyof typeof META_DEFAULTS

/** Later wins; equal times keep what is there (as the server does). */
const newer = (local: { updatedAt: string } | undefined, remote: { updatedAt: string }) => !local || Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)

interface Schema extends DBSchema {
  collections: { key: string; value: Collection }
  entries: { key: [string, number]; value: Entry; indexes: { byCollection: string } }
  outbox: { key: number; value: Change }
  games: { key: number; value: Game }
  lists: { key: [ListKind, number]; value: StoredList }
  publishers: { key: number; value: { companyId: number; name: string } }
  meta: { key: string; value: unknown }
  /** F008 (version 2) */
  bggCollections: { key: string; value: StoredBggCollection }
  follows: { key: string; value: FollowedBggUser }
}

const dbName = (email: string) => `board-a-licious-${email.toLowerCase()}`

export async function deleteStore(email: string) {
  await deleteDB(dbName(email))
}

/** One IndexedDB database per signed-in person (data-model.md), so people sharing a phone stay apart. */
export async function openStore(rawEmail: string) {
  const email = rawEmail.toLowerCase()
  const db: IDBPDatabase<Schema> = await openDB<Schema>(dbName(email), 2, {
    // each version only adds stores, so the data of older versions stays
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('collections', { keyPath: 'id' })
        db.createObjectStore('entries', { keyPath: ['collectionId', 'bggId'] }).createIndex('byCollection', 'collectionId')
        db.createObjectStore('outbox', { autoIncrement: true })
        db.createObjectStore('games', { keyPath: 'bggId' })
        db.createObjectStore('lists', { keyPath: ['kind', 'id'] })
        db.createObjectStore('publishers', { keyPath: 'companyId' })
        db.createObjectStore('meta')
      }
      if (oldVersion < 2) {
        db.createObjectStore('bggCollections', { keyPath: 'bggUser' })
        db.createObjectStore('follows', { keyPath: 'bggUser' })
      }
    },
  })

  const listeners = new Set<() => void>()
  const changed = () => listeners.forEach(listener => listener())

  async function saveFollow(row: FollowedBggUser) {
    const tx = db.transaction(['follows', 'outbox'], 'readwrite')
    await Promise.all([tx.objectStore('follows').put(row), tx.objectStore('outbox').add({ kind: 'follow', row }), tx.done])
    changed()
  }

  /** The synced setting row with one part changed, stored and queued in one transaction. */
  async function saveSetting(change: () => Partial<UserSetting>, updatedAt: string) {
    const tx = db.transaction(['meta', 'outbox'], 'readwrite')
    const current = (await tx.objectStore('meta').get('bggSetting')) as UserSetting | undefined
    const next = { bggUsername: current?.bggUsername ?? null, ...(current?.lengthLimits !== undefined && { lengthLimits: current.lengthLimits }), ...change() }
    // key order as the server sends it back: bggUsername, lengthLimits, updatedAt
    const row: UserSetting = { bggUsername: next.bggUsername, ...(next.lengthLimits !== undefined && { lengthLimits: next.lengthLimits }), updatedAt }
    await Promise.all([tx.objectStore('meta').put(row, 'bggSetting'), tx.objectStore('outbox').add({ kind: 'setting', row }), tx.done])
    changed()
  }

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

    /**
     * Read-modify-write of entries in ONE transaction: `change` returns the new entry or null to
     * leave it. Background work (details, list facts) uses this, so a mark saved at the same moment
     * is never overwritten by an older copy. Returns the changed entries.
     */
    async updateEntries(change: (entry: Entry) => Entry | null): Promise<Entry[]> {
      const tx = db.transaction(['entries', 'outbox'], 'readwrite')
      const changed: Entry[] = []
      for (let cursor = await tx.objectStore('entries').openCursor(); cursor; cursor = await cursor.continue()) {
        const next = change(cursor.value)
        if (!next) continue
        void cursor.update(next)
        void tx.objectStore('outbox').add({ kind: 'entry', row: next })
        changed.push(next)
      }
      await tx.done
      if (changed.length > 0) listeners.forEach(listener => listener())
      return changed
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

    /** F008: the person's BGG username, or null. */
    async bggUsername(): Promise<string | null> {
      return ((await db.get('meta', 'bggSetting')) as UserSetting | undefined)?.bggUsername ?? null
    },
    /** F008: sets (or with null or blanks clears) the BGG username and queues it for the other devices. */
    async setBggUsername(name: string | null, updatedAt = new Date().toISOString()) {
      await saveSetting(() => ({ bggUsername: name?.trim() || null }), updatedAt)
    },
    /** F009: where Short, Middle and Long end; the defaults when never set, reset or broken. */
    async lengthLimits(): Promise<LengthLimits> {
      const limits = ((await db.get('meta', 'bggSetting')) as UserSetting | undefined)?.lengthLimits
      return validLengthLimits(limits) ? limits : [...DEFAULT_LENGTH_LIMITS]
    },
    /** F009: sets (or with null resets) the length limits and queues them for the other devices. */
    async setLengthLimits(limits: LengthLimits | null, updatedAt = new Date().toISOString()) {
      await saveSetting(() => ({ lengthLimits: limits }), updatedAt)
    },
    /** F008: the followed BGG users (lower-cased, sorted), without the removed ones. */
    async follows(): Promise<string[]> {
      return (await db.getAll('follows')).filter(f => !f.deleted).map(f => f.bggUser).sort()
    },
    async follow(bggUser: string, updatedAt = new Date().toISOString()) {
      await saveFollow({ bggUser: bggUser.trim().toLowerCase(), updatedAt, deleted: false })
    },
    async unfollow(bggUser: string, updatedAt = new Date().toISOString()) {
      await saveFollow({ bggUser: bggUser.trim().toLowerCase(), updatedAt, deleted: true })
    },

    /** F008: a BGG collection read on this device (never synced), by BGG user in any case. */
    async bggCollection(bggUser: string) {
      return db.get('bggCollections', bggUser.toLowerCase())
    },
    async bggCollections() {
      return db.getAll('bggCollections')
    },
    async putBggCollection(collection: StoredBggCollection) {
      await db.put('bggCollections', { ...collection, bggUser: collection.bggUser.toLowerCase() })
      changed()
    },

    /** Rows from the server, merged last-write-wins; not queued again. */
    async applyRemote(changes: {
      collections: Collection[]
      entries: Entry[]
      lists?: LoadedList[]
      settings?: UserSetting[]
      follows?: FollowedBggUser[]
    }) {
      const tx = db.transaction(['collections', 'entries', 'lists', 'meta', 'follows'], 'readwrite')
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
        void lists.put({ kind: ref.kind, id: ref.id, title: ref.title, pageCount: 0, loadedPages: 0, entries: [], openedAt: ref.updatedAt, shared: true })
      }
      // F008: the username and the followed BGG users, tombstones kept so an older follow cannot revive them
      const meta = tx.objectStore('meta')
      for (const remote of changes.settings ?? []) {
        const local = (await meta.get('bggSetting')) as UserSetting | undefined
        // F009: a setting from an older server or app without lengthLimits keeps the ones here
        const row = remote.lengthLimits === undefined && local?.lengthLimits !== undefined ? { ...remote, lengthLimits: local.lengthLimits } : remote
        if (newer(local, remote)) void meta.put(row, 'bggSetting')
      }
      const follows = tx.objectStore('follows')
      for (const remote of changes.follows ?? []) {
        const row = { ...remote, bggUser: remote.bggUser.toLowerCase() }
        if (newer(await follows.get(row.bggUser), row)) void follows.put(row)
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
    /** F008: a device meta value, or its default when never set. */
    async metaOrDefault<K extends MetaWithDefault>(key: K): Promise<MetaValues[K]> {
      return ((await db.get('meta', key)) as MetaValues[K] | undefined) ?? (META_DEFAULTS[key] as MetaValues[K])
    },
    async setMeta<K extends keyof MetaValues>(key: K, value: MetaValues[K]) {
      await db.put('meta', value, key)
      changed()
    },
  }
}

export type Store = Awaited<ReturnType<typeof openStore>>
export { entryKey }
