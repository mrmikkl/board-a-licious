import { type GameLink, parseGameLink } from './bgg-link.ts'
import { fold } from './search.ts'

/** F006: one game found by BoardGameGeek's search (data-model SearchResult); not stored on the device. */
export type SearchResult = {
  bggId: number
  name: string
  year: number | null
  kind: 'boardgame' | 'expansion'
}

export type SearchQuery = { ok: true; text: string; key: string } | { ok: false; reason: 'short' | 'long' }

export const MIN_QUERY = 2
export const MAX_QUERY = 100

/** Trimmed, inner whitespace collapsed; valid for 2–100 characters. `key` is the cache key (lower case). */
export function searchQuery(raw: string): SearchQuery {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (text.length < MIN_QUERY) return { ok: false, reason: 'short' }
  if (text.length > MAX_QUERY) return { ok: false, reason: 'long' }
  return { ok: true, text, key: text.toLowerCase() }
}

/**
 * Research R5: exact name matches first, then names starting with the text, then the rest (BGG also
 * matches other words and other-language names); within each group the shorter name, then alphabetical.
 */
export function rankResults(results: SearchResult[], query: string, limit: number): SearchResult[] {
  const q = fold(query.trim())
  const tier = (name: string) => {
    const n = fold(name)
    return n === q ? 0 : n.startsWith(q) ? 1 : 2
  }
  return results
    .map(game => ({ game, tier: tier(game.name) }))
    .sort((a, b) => a.tier - b.tier || a.game.name.length - b.game.name.length || a.game.name.localeCompare(b.game.name))
    .slice(0, limit)
    .map(x => x.game)
}

export type GameInput = { kind: 'empty' } | { kind: 'link'; link: GameLink } | { kind: 'name'; query: SearchQuery }

const LINK_LIKE = /boardgamegeek|bgg\.|https?:|\/boardgame/i

/** Research R9: what the Add game field holds: nothing, a BoardGameGeek link, or a name to search. */
export function parseGameInput(text: string): GameInput {
  if (text.trim() === '') return { kind: 'empty' }
  if (LINK_LIKE.test(text)) return { kind: 'link', link: parseGameLink(text) }
  return { kind: 'name', query: searchQuery(text) }
}
