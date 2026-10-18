import { BggError, type BggClient, TTL } from './cache.ts'
import type { GameDetails } from '../../src/domain/game-info.ts'
import type { Game } from './source.ts'

type Link = { name?: string }
/** The parts of a BGG geekitem that describe the game: players and linked designers, mechanics, publishers. */
export type GeekItemInfo = {
  minplayers?: string | number | null
  maxplayers?: string | number | null
  links?: { boardgamedesigner?: Link[]; boardgamemechanic?: Link[]; boardgamepublisher?: Link[] } | null
}

const count = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}
const names = (links: Link[] | undefined) => [...new Set((links ?? []).map(l => l.name?.trim()).filter((n): n is string => Boolean(n)))]

/** Players, designers, mechanisms and the first publisher (FR-010); unknown parts are null or empty. */
export function gameDetails(item: GeekItemInfo | null | undefined): GameDetails {
  return {
    minPlayers: count(item?.minplayers),
    maxPlayers: count(item?.maxplayers),
    designers: names(item?.links?.boardgamedesigner),
    mechanisms: names(item?.links?.boardgamemechanic),
    publisher: names(item?.links?.boardgamepublisher)[0] ?? null,
  }
}

type GeekItem = GeekItemInfo & {
  objectid: number | string
  name: string
  yearpublished?: string | number | null
  subtype?: string
  short_description?: string | null
  images?: { square200?: string | null } | null
}

const toGame = (item: GeekItem): Game => {
  const year = Number(item.yearpublished)
  return {
    bggId: Number(item.objectid),
    name: item.name,
    year: Number.isInteger(year) && year > 0 ? year : null,
    thumbnailUrl: item.images?.square200 || null,
    description: item.short_description || null,
    kind: item.subtype === 'boardgameexpansion' ? 'expansion' : 'boardgame',
    ...gameDetails(item),
  }
}

/** Game details from `api/geekitems?objectid=<id>&objecttype=thing`; unknown games are left out. */
export async function getGames(client: BggClient, ids: number[]): Promise<Game[]> {
  const games: Game[] = []
  for (const id of ids) {
    try {
      const body = await client.getJson<{ item?: GeekItem | null } | null>(
        `https://api.geekdo.com/api/geekitems?objectid=${id}&objecttype=thing`,
        TTL.game,
      )
      if (body?.item?.name) games.push(toGame(body.item))
    } catch (error) {
      if (error instanceof BggError && error.code === 'not_found') continue
      throw error
    }
  }
  return games
}
