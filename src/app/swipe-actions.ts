import type { StoredList, StoredListEntry } from '../client/types.ts'
import type { Collection } from '../domain/collection.ts'
import { type SwipeDirection, swipeDecision } from '../domain/swipe.ts'
import type { AppServices } from './context.tsx'

/**
 * One swipe decision (FR-015): right adds the game as Not yet marked, left as Not interested. A game
 * this device has no details for yet stands in with the list's name and cover and is completed in the
 * background (FR-017), like a game added by link.
 */
export async function decideSwipe(services: AppServices, collection: Collection, list: StoredList, game: StoredListEntry, direction: SwipeDirection) {
  const { store } = services
  services.feedback.swipe()
  const known = await store.game(game.bggId)
  if (!known) {
    await store.putGames([{ bggId: game.bggId, name: game.name, year: null, thumbnailUrl: game.thumbnailUrl, description: null, kind: 'boardgame' }])
  }
  const now = new Date().toISOString()
  await store.saveEntry(swipeDecision({ collection, game, listIsEssen: list.isEssen, direction, now, detailsPending: !known }))
  void services.sync.schedule()
  if (!known) void services.completeDetails()
}

/** Year and description for the next cards; a failure just leaves the cards without them. */
export async function loadCardDetails(services: AppServices, ids: number[]) {
  const known = new Set((await services.store.games(ids)).map(g => g.bggId))
  const missing = ids.filter(id => !known.has(id))
  if (missing.length === 0) return
  try {
    const games = await services.api.games(missing)
    if (games.length > 0) await services.store.putGames(games)
  } catch {
    // offline or BGG unreachable: the cards show name and cover from the list
  }
}
