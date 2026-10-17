import { type Backup, type Resolution, backupFileName, exportBackup, parseBackup, planImport } from '../domain/backup.ts'
import type { Game } from '../client/types.ts'
import type { AppServices } from './context.tsx'

/** Share and backup (FR-020, FR-021, contracts/share-and-backup.md). */
const now = () => new Date().toISOString()

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** The phone's share menu (Web Share API), else the clipboard. */
export async function shareList(text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // no permission or not supported here: fall back to the clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** All collections as one file, game names from the device's cache. */
export async function backupFile(services: AppServices): Promise<{ name: string; text: string }> {
  const { store } = services
  const [collections, entries] = await Promise.all([store.collections(), store.allEntries()])
  const games = new Map((await store.games([...new Set(entries.map(e => e.bggId))])).map(g => [g.bggId, g]))
  const at = now()
  return { name: backupFileName(at), text: JSON.stringify(exportBackup({ collections, entries, games, now: at }), null, 2) }
}

export type ImportCheck = { ok: false; error: string } | { ok: true; backup: Backup; games: number; collections: number }

/** Checks a file and counts what differs from the device, so the person is asked once (FR-021). */
export async function checkImport(services: AppServices, text: string): Promise<ImportCheck> {
  const parsed = parseBackup(text)
  if (!parsed.ok) return parsed
  const planned = await plan(services, parsed.backup, 'keep')
  const games = planned.conflicts.filter(c => c.bggId !== null).length
  return { ok: true, backup: parsed.backup, games, collections: planned.conflicts.length - games }
}

/**
 * Saves the import through the outbox, like manual edits. Games new to this device get the backup's
 * name right away and their BGG details in the background (FR-017).
 */
export async function applyImport(services: AppServices, backup: Backup, resolution: Resolution) {
  const { store } = services
  const { collections, entries, games } = await plan(services, backup, resolution)
  const ids = [...new Set(entries.map(e => e.bggId))]
  const known = new Set((await store.games(ids)).map(g => g.bggId))
  const named: Game[] = ids
    .filter(id => !known.has(id) && games.has(id))
    .map(id => ({ bggId: id, ...games.get(id)!, thumbnailUrl: null, description: null, kind: 'boardgame' }))
  if (named.length > 0) await store.putGames(named)
  for (const collection of collections) await store.saveCollection(collection)
  if (entries.length > 0) await store.saveEntries(entries.map(e => (known.has(e.bggId) ? e : { ...e, detailsPending: true })))
  void services.sync.schedule()
  void services.completeDetails()
  return { collections: collections.length, games: entries.length }
}

async function plan(services: AppServices, backup: Backup, resolution: Resolution) {
  const { store } = services
  const [collections, entries] = await Promise.all([store.collections(), store.allEntries()])
  return planImport({ current: { collections, entries }, backup, resolution, now: now(), newId: () => crypto.randomUUID() })
}
