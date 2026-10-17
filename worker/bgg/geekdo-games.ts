import { BggError, type BggClient, TTL } from './cache.ts'
import type { Game } from './source.ts'

type GeekItem = {
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
