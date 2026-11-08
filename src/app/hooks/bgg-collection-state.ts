import type { StoredBggCollection } from '../../client/types.ts'
import type { BggCollectionAnswer, BggCollectionItem, Status } from '../../domain/bgg-status.ts'

/** FR-004: a collection read less than an hour ago is not read again on open. */
export const FRESH_MS = 60 * 60 * 1000
/** FR-005: how long the app keeps asking while BGG prepares a collection. */
export const GIVE_UP_MS = 60 * 1000
const PAUSES_MS = [5000, 10000, 20000]

export function isFresh(loadedAt: string | null | undefined, now: number): boolean {
  const at = loadedAt ? Date.parse(loadedAt) : Number.NaN
  return !Number.isNaN(at) && now - at < FRESH_MS
}

/** The pause before asking again after the `attempt`-th "preparing" (1, 2, …); null to give up. */
export function nextRetry(attempt: number, startedAt: number, now: number): number | null {
  if (now - startedAt >= GIVE_UP_MS) return null
  return PAUSES_MS[Math.max(attempt, 1) - 1] ?? PAUSES_MS[PAUSES_MS.length - 1]!
}

export type LoadOutcome = { kind: 'loaded'; answer: BggCollectionAnswer } | { kind: 'not_found' } | { kind: 'offline' } | { kind: 'failed' }

/** What the device keeps after a load; offline or failing keeps the stored copy and its time (FR-006). */
export function nextCollection(user: string, stored: StoredBggCollection | undefined, outcome: LoadOutcome, now: number): StoredBggCollection | undefined {
  const bggUser = user.toLowerCase()
  if (outcome.kind === 'loaded') return { bggUser, items: outcome.answer.items, loadedAt: outcome.answer.loadedAt, error: null }
  if (outcome.kind === 'not_found') return { bggUser, items: [], loadedAt: new Date(now).toISOString(), error: 'not_found' }
  return stored
}

/** The statuses of a collection by BGG id; empty without one (no badges, never a wrong one). */
export function statusMap(collection: StoredBggCollection | undefined): Map<number, Status> {
  return new Map((collection?.items ?? []).map(item => [item.bggId, item.status]))
}

/**
 * F008 (FR-017): the stored copy after a save on BGG, so badges and status lists show it at once: the
 * game's status replaced (or the game added); without a copy yet, one that is read from BGG on next use.
 */
export function withSavedStatus(user: string, stored: StoredBggCollection | undefined, game: Omit<BggCollectionItem, 'status'>, status: Status): StoredBggCollection {
  const item: BggCollectionItem = { ...game, status }
  const items = stored?.items ?? []
  const next = items.some(i => i.bggId === game.bggId) ? items.map(i => (i.bggId === game.bggId ? { ...i, status } : i)) : [...items, item]
  return { bggUser: user.toLowerCase(), loadedAt: null, error: null, ...stored, items: next }
}
