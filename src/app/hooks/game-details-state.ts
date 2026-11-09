import { ApiError } from '../../client/api.ts'
import type { Game } from '../../client/types.ts'

/** Ids per `/api/bgg/games` call: the Worker's `fetchLimit`, so one call is at most two BGG requests (research R1). */
export const CHUNK = 40

/** F009 (research R2): a game stored before the playing time existed lacks the key and is read again. */
export function hasFilterDetails(game: Game | undefined): boolean {
  return game !== undefined && 'playingTime' in game
}

/** The list's ids whose details the filter still needs, once each, in list order. */
export function missingIds(ids: number[], stored: Game[]): number[] {
  const known = new Set(stored.filter(hasFilterDetails).map(g => g.bggId))
  return [...new Set(ids)].filter(id => !known.has(id))
}

export type ReadOutcome = { kind: 'done' } | { kind: 'offline' } | { kind: 'failed' } | { kind: 'cancelled' }

/**
 * US4 (FR-009, FR-010): reads the given games' details in chunks of 40, one call after the other (the
 * Worker paces BGG), and stores each answer at once so the filter grows as they arrive. Ids the Worker
 * left out are asked again later; ids a whole call did not answer are given up for this run. Stops at
 * the first failure, keeping what arrived; `onProgress` gets how many games arrived so far.
 */
export async function readDetails(deps: {
  ids: number[]
  api: { games(ids: number[]): Promise<Game[]> }
  store: { putGames(games: Game[]): Promise<void> }
  onProgress: (arrived: number) => void
  cancelled?: () => boolean
}): Promise<ReadOutcome> {
  const { api, store, onProgress, cancelled = () => false } = deps
  let queue = [...deps.ids]
  let arrived = 0
  while (queue.length > 0) {
    if (cancelled()) return { kind: 'cancelled' }
    const asked = queue.slice(0, CHUNK)
    let games: Game[]
    try {
      games = await api.games(asked)
    } catch (error) {
      return { kind: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'failed' }
    }
    const found = new Set(games.map(g => g.bggId))
    const answered = asked.filter(id => found.has(id))
    const rest = queue.slice(CHUNK)
    // nothing of this call came back: BGG does not know these ids, do not ask for them again now
    queue = answered.length === 0 ? rest : [...rest, ...asked.filter(id => !found.has(id))]
    if (games.length === 0) continue
    await store.putGames(games)
    arrived += answered.length
    onProgress(arrived)
  }
  return { kind: 'done' }
}
