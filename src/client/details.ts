import type { Store } from './store.ts'
import type { Game } from './types.ts'

const CHUNK = 50

/**
 * Completes games added by link (FR-017): fetches BGG details for entries with `detailsPending` and
 * clears the flag; mark, bought and price stay as they are. Games this device has no details for yet
 * (entries synced from another device) are fetched too. Failures keep the entries pending for the next
 * run. Returns how many pending entries were completed.
 */
export async function completeDetails(deps: { store: Store; api: { games(ids: number[]): Promise<Game[]> }; now: () => string }) {
  const { store, api, now } = deps
  const live = (await store.allEntries()).filter(e => !e.deleted)
  const allIds = [...new Set(live.map(e => e.bggId))]
  const known = new Set((await store.games(allIds)).map(g => g.bggId))
  const pendingIds = new Set(live.filter(e => e.detailsPending).map(e => e.bggId))
  const ids = allIds.filter(id => pendingIds.has(id) || !known.has(id))
  let completed = 0
  for (let i = 0; i < ids.length; i += CHUNK) {
    let games: Game[]
    try {
      games = await api.games(ids.slice(i, i + CHUNK))
    } catch {
      return completed
    }
    if (games.length === 0) continue
    await store.putGames(games)
    const found = new Set(games.map(g => g.bggId))
    // read and write in one transaction: a mark made meanwhile is kept
    const done = await store.updateEntries(e =>
      e.detailsPending && !e.deleted && found.has(e.bggId) ? { ...e, detailsPending: false, updatedAt: now() } : null,
    )
    completed += done.length
  }
  return completed
}
