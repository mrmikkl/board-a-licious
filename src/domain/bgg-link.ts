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
