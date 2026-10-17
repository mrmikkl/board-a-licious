import type { BggClient } from './cache.ts'
import type { Game } from './source.ts'

/** T030: game details from `api/geekitems?objectid=<id>&objecttype=thing`. */
export async function getGames(_client: BggClient, _ids: number[]): Promise<Game[]> {
  throw new Error('not implemented yet (T030)')
}
