import type { StatusKey } from './bgg-status.ts'

export type GameLink = { ok: true; bggId: number; suggestedName: string } | { ok: false; message: string }

const BGG_URL = /(?:https?:\/\/)?(?:www\.)?boardgamegeek\.com(\/[^\s?#]*)?/i
const GAME_PATH = /^\/(?:boardgame|boardgameexpansion)\/(\d+)(?:\/([^/]+))?/i

/** "ark-nova" → "Ark Nova" */
const nameFromSlug = (slug: string) =>
  decodeURIComponent(slug)
    .split('-')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/** The game ID and a suggested name from a pasted BGG game link (FR-016); the text may hold more than the link. */
export function parseGameLink(text: string): GameLink {
  if (text.trim() === '') return { ok: false, message: 'Paste the link to a game on BoardGameGeek.' }
  const url = BGG_URL.exec(text)
  if (!url) return { ok: false, message: 'This is not a BoardGameGeek link. Copy the link of the game page on boardgamegeek.com.' }
  const game = GAME_PATH.exec(url[1] ?? '')
  const bggId = Number(game?.[1])
  if (!game || !Number.isSafeInteger(bggId) || bggId <= 0) {
    return { ok: false, message: 'This BoardGameGeek link does not point to a game. Open the game page and copy its game link.' }
  }
  return { ok: true, bggId, suggestedName: game[2] ? nameFromSlug(game[2]) : '' }
}

export const gameUrl = (bggId: number) => `https://boardgamegeek.com/boardgame/${bggId}`

/** A BGG collection link: the user and, when the link filters by one, the status (FR-007). */
export type BggCollectionLink = { bggUser: string; status?: StatusKey }

const COLLECTION_URL = /(?:https?:\/\/)?(?<![\w.-])(?:www\.)?boardgamegeek\.com\/collection\/user\/([^\s/?#]+)\/?(\?[^\s#]*)?(?=[\s#]|$)/i

/** BGG's status query parameters, in badge order. */
const STATUS_PARAMS: [string, StatusKey][] = [
  ['own', 'own'], ['preordered', 'preordered'], ['wishlist', 'wishlist'], ['wanttoplay', 'wantToPlay'],
  ['trade', 'forTrade'], ['want', 'wantInTrade'], ['wanttobuy', 'wantToBuy'], ['prevowned', 'prevOwned'],
]

/** Reads a pasted link to someone's BGG collection page; null for anything else. */
export function parseBggCollectionLink(text: string): BggCollectionLink | null {
  const match = COLLECTION_URL.exec(text)
  if (!match) return null
  let bggUser: string
  try {
    bggUser = decodeURIComponent(match[1] ?? '').trim().toLowerCase()
  } catch {
    return null
  }
  if (!bggUser) return null
  const params = new URLSearchParams(match[2] ?? '')
  const status = STATUS_PARAMS.find(([param]) => params.get(param) === '1')?.[1]
  return status ? { bggUser, status } : { bggUser }
}
