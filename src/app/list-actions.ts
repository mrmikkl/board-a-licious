import type { StoredList, StoredListEntry } from '../client/types.ts'
import { membershipChanges } from '../domain/membership.ts'
import type { AppServices } from './context.tsx'

const now = () => new Date().toISOString()

/**
 * Done in the list game sheet (FR-014): new ticks become entries (facts per FR-010), unticked ones
 * tombstones. Until BGG details arrive the list's name and cover stand in for the game on this
 * device; new entries are marked `detailsPending` unless the device already has the details (FR-017).
 */
export async function applyMembership(services: AppServices, list: StoredList, item: StoredListEntry, before: Set<string>, after: Set<string>) {
  const { store } = services
  const { adds, removals } = membershipChanges({
    bggId: item.bggId,
    before,
    after,
    collections: await store.collections(),
    entries: await store.allEntries(),
    facts: item.facts,
    now: now(),
  })
  if (adds.length + removals.length === 0) return { added: 0, removed: 0 }
  const game = await store.game(item.bggId)
  const hasDetails = Boolean(game && (game.year !== null || game.description !== null))
  if (!game) {
    await store.putGames([{ bggId: item.bggId, name: item.name, year: null, thumbnailUrl: item.thumbnailUrl, description: null, kind: 'boardgame' }])
  }
  await store.saveEntries([...adds.map(e => ({ ...e, detailsPending: !hasDetails })), ...removals])
  void services.sync.schedule()
  if (adds.length > 0 && !hasDetails) void services.completeDetails()
  return { added: adds.length, removed: removals.length }
}
