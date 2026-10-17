import { type Collection, type Entry, newEntry } from './collection.ts'
import { type ListFacts, factsFromList } from './facts.ts'

/** A game on a list, as far as swiping needs it. */
export type SwipeGame = { position: number; bggId: number; facts?: ListFacts }

export type SwipeList<G extends SwipeGame> = { loadedPages: number; pageCount: number; entries: G[] }

export type SwipeDirection = 'right' | 'left'

/**
 * The cards still to decide (FR-015): the list's games in list order, without games already in the
 * collection (any mark, Not interested included; removed games count as not in it). While pages are
 * missing the loaded games are offered and `loadingMore` is set; `allDecided` only once nothing is
 * left on a fully loaded list.
 */
export function swipeQueue<G extends SwipeGame>(list: SwipeList<G>, entries: Pick<Entry, 'bggId' | 'deleted'>[]) {
  const seen = new Set(entries.filter(e => !e.deleted).map(e => e.bggId))
  const games: G[] = []
  for (const game of [...list.entries].sort((a, b) => a.position - b.position)) {
    if (seen.has(game.bggId)) continue
    seen.add(game.bggId)
    games.push(game)
  }
  const loadingMore = list.loadedPages < list.pageCount
  return { games, loadingMore, allDecided: games.length === 0 && !loadingMore }
}

/** Right adds the game as Not yet marked, left as Not interested; facts follow FR-010. */
export function swipeDecision(input: {
  collection: Pick<Collection, 'id' | 'type'>
  game: SwipeGame
  listIsEssen: boolean
  direction: SwipeDirection
  now: string
  detailsPending?: boolean
}): Entry {
  const { collection, game, listIsEssen, direction, now } = input
  return {
    ...newEntry(collection.id, game.bggId, now),
    mark: direction === 'right' ? 'new' : 'skip',
    ...factsFromList(game.facts, listIsEssen, collection.type),
    detailsPending: input.detailsPending ?? false,
  }
}
