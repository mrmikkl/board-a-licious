import type { Store } from './store.ts'
import type { Game } from './types.ts'

const CHUNK = 50

/**
 * Completes games added by link (FR-017): fetches BGG details for entries with `detailsPending` and
 * clears the flag; mark, bought and price stay as they are. Failures keep the entries pending for the
 * next run. Returns how many entries were completed.
 */
export async function completeDetails(deps: { store: Store; api: { games(ids: number[]): Promise<Game[]> }; now: () => string }) {
  const { store, api, now } = deps
  const pending = (await store.allEntries()).filter(e => e.detailsPending && !e.deleted)
  const ids = [...new Set(pending.map(e => e.bggId))]
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
    const done = pending.filter(e => found.has(e.bggId)).map(e => ({ ...e, detailsPending: false, updatedAt: now() }))
    await store.saveEntries(done)
    completed += done.length
  }
  return completed
}
