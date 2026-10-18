import {
  type Collection,
  type Entry,
  entryKey,
  newEntry,
  validateCollection,
  validateEntry,
} from './collection.ts'
import type { GameNames } from './share.ts'

/** Backup file version 3 (contracts/share-and-backup.md); version 2 also had a collection type. */
export const FORMAT = 'board-a-licious-backup'
export const VERSION = 3
export const IMPORTED = 'Imported'

type EntryData = Pick<Entry, 'bggId' | 'mark' | 'bought' | 'paidCents' | 'paidCurrency' | 'facts' | 'factsSource'>

export type BackupEntry = EntryData & { name: string | null; year: number | null; updatedAt: string }

export type BackupFile = {
  format: typeof FORMAT
  version: typeof VERSION
  exportedAt: string
  collections: Array<Pick<Collection, 'id' | 'name' | 'updatedAt'> & { entries: BackupEntry[] }>
}

/** A checked backup; `id` is null for the version 1 collection, which goes into "Imported". */
export type Backup = {
  collections: Array<{ id: string | null; name: string; entries: EntryData[] }>
  games: Map<number, { name: string; year: number | null }>
}

export type Resolution = 'keep' | 'backup'

/** A collection (`bggId` null) or entry that differs between the device and the backup. */
export type Conflict = { collectionId: string; bggId: number | null }

export type ImportPlan = {
  collections: Collection[]
  entries: Entry[]
  conflicts: Conflict[]
  games: Backup['games']
}

export const backupFileName = (now: string) => `board-a-licious-backup-${now.slice(0, 10)}.json`

/** All active collections and entries, with game names from the lookup. */
export function exportBackup(input: { collections: Collection[]; entries: Entry[]; games: GameNames; now: string }): BackupFile {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: input.now,
    collections: input.collections
      .filter(c => !c.deleted)
      .map(c => ({
        id: c.id,
        name: c.name,
        updatedAt: c.updatedAt,
        entries: input.entries
          .filter(e => e.collectionId === c.id && !e.deleted)
          .map(e => ({
            bggId: e.bggId,
            name: input.games.get(e.bggId)?.name ?? null,
            year: input.games.get(e.bggId)?.year ?? null,
            mark: e.mark,
            bought: e.bought,
            paidCents: e.paidCents,
            paidCurrency: e.paidCurrency,
            facts: e.facts,
            factsSource: e.factsSource,
            updatedAt: e.updatedAt,
          })),
      })),
  }
}

class Invalid extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks one row of a file and returns its entry data; throws Invalid with the first problem. */
function readEntry(raw: unknown, where: string, games: Backup['games'], v1: boolean): EntryData {
  if (!isObject(raw)) throw new Invalid(`${where}: An entry must be an object.`)
  const row = v1
    ? { ...newEntry('import', raw.bggId as number, raw.updatedAt as string), mark: raw.state }
    : {
        ...raw,
        collectionId: 'import',
        paidCents: raw.paidCents ?? null,
        paidCurrency: raw.paidCurrency ?? null,
        facts: raw.facts ?? null,
        factsSource: raw.factsSource ?? null,
        detailsPending: false,
        deleted: false,
      }
  const error = validateEntry(row as Entry)
  if (error) throw new Invalid(`${where}: ${error}`)
  if (raw.name != null && typeof raw.name !== 'string') throw new Invalid(`${where}: The game name must be text.`)
  if (raw.year != null && !Number.isInteger(raw.year)) throw new Invalid(`${where}: The year must be a whole number.`)
  const e = row as Entry
  if (typeof raw.name === 'string') games.set(e.bggId, { name: raw.name, year: (raw.year as number | null) ?? null })
  return {
    bggId: e.bggId,
    mark: e.mark,
    bought: e.bought,
    paidCents: e.paidCents,
    paidCurrency: e.paidCurrency,
    facts: e.facts,
    factsSource: e.factsSource,
  }
}

function readEntries(list: unknown, where: (i: number) => string, games: Backup['games'], v1: boolean): EntryData[] {
  const seen = new Set<number>()
  return (list as unknown[]).map((raw, i) => {
    const e = readEntry(raw, where(i), games, v1)
    if (seen.has(e.bggId)) throw new Invalid(`${where(i)}: The game ${e.bggId} is listed twice.`)
    seen.add(e.bggId)
    return e
  })
}

function read(data: unknown): Backup {
  if (!isObject(data) || data.format !== FORMAT) throw new Invalid('This file is not a Board-a-licious backup.')
  const version = data.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    throw new Invalid('The backup version is missing or unknown.')
  if (version > VERSION) throw new Invalid(`This backup comes from a newer version of Board-a-licious (version ${version}).`)
  const games: Backup['games'] = new Map()

  if (version === 1) {
    if (!Array.isArray(data.entries)) throw new Invalid('The backup has no list of games.')
    const entries = readEntries(data.entries, i => `Game ${i + 1}`, games, true)
    return { collections: [{ id: null, name: IMPORTED, entries }], games }
  }

  if (!Array.isArray(data.collections)) throw new Invalid('The backup has no list of collections.')
  const ids = new Set<string>()
  const collections = data.collections.map((raw: unknown, i: number) => {
    const c = isObject(raw) ? raw : {}
    const where = `Collection ${i + 1}${typeof c.name === 'string' ? ` ("${c.name}")` : ''}`
    const error = validateCollection({ ...c, deleted: false } as Collection)
    if (error) throw new Invalid(`${where}: ${error}`)
    const { id, name } = c as Collection
    if (ids.has(id)) throw new Invalid(`${where}: The id "${id}" is used twice.`)
    ids.add(id)
    if (!Array.isArray(c.entries)) throw new Invalid(`${where}: The collection has no list of games.`)
    const entries = readEntries(c.entries, j => `${where}, game ${j + 1}`, games, false)
    return { id, name: name.trim(), entries }
  })
  return { collections, games }
}

/** Parses and checks a backup file; on error nothing may change and the message names the first problem. */
export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not a backup: it is not JSON.' }
  }
  try {
    return { ok: true, backup: read(data) }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message }
    throw e
  }
}

const factsKey = (e: EntryData) =>
  e.facts
    ? JSON.stringify([e.facts.booth ?? null, e.facts.priceCents ?? null, e.facts.currency ?? null, e.facts.publisher ?? null])
    : null

const sameData = (a: EntryData, b: EntryData) =>
  a.mark === b.mark &&
  a.bought === b.bought &&
  (a.paidCents ?? null) === (b.paidCents ?? null) &&
  (a.paidCurrency ?? null) === (b.paidCurrency ?? null) &&
  (a.factsSource ?? null) === (b.factsSource ?? null) &&
  factsKey(a) === factsKey(b)

/**
 * What to save for an import: missing (or deleted) collections and entries are added, differing ones
 * are conflicts, kept or overwritten for all at once. Every saved row gets `now` so it wins sync.
 */
export function planImport(input: {
  current: { collections: Collection[]; entries: Entry[] }
  backup: Backup
  resolution: Resolution
  now: string
  newId: () => string
}): ImportPlan {
  const { current, backup, resolution, now } = input
  const active = new Map(current.entries.filter(e => !e.deleted).map(e => [entryKey(e), e]))
  const plan: ImportPlan = { collections: [], entries: [], conflicts: [], games: backup.games }

  for (const bc of backup.collections) {
    const existing =
      bc.id === null
        ? current.collections.find(c => !c.deleted && c.name === IMPORTED)
        : current.collections.find(c => c.id === bc.id)
    const id = existing?.id ?? bc.id ?? input.newId()
    const fresh: Collection = { id, name: bc.name, updatedAt: now, deleted: false }
    if (!existing || existing.deleted) plan.collections.push(fresh)
    else if (existing.name !== bc.name) {
      plan.conflicts.push({ collectionId: id, bggId: null })
      if (resolution === 'backup') plan.collections.push(fresh)
    }

    for (const data of bc.entries) {
      const row: Entry = { ...newEntry(id, data.bggId, now), ...data }
      const mine = active.get(entryKey(row))
      if (!mine) plan.entries.push(row)
      else if (!sameData(mine, data)) {
        plan.conflicts.push({ collectionId: id, bggId: data.bggId })
        if (resolution === 'backup') plan.entries.push({ ...row, detailsPending: mine.detailsPending })
      }
    }
  }
  return plan
}
