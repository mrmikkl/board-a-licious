import { getCachedGames, upsertGames } from '../db/repository.ts'
import { HttpError } from '../http.ts'
import type { RouteContext } from './context.ts'

const MAX_IDS = 50
const FRESH_MS = 7 * 86400 * 1000

function parseIds(raw: string | null): number[] {
  const parts = (raw ?? '').split(',')
  const ids = parts.map(Number)
  if (!raw || parts.length > MAX_IDS || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new HttpError('bad_request', `ids must be 1–${MAX_IDS} positive whole numbers, separated by commas.`)
  }
  return [...new Set(ids)]
}

/** GET /api/bgg/games?ids=1,2 (contracts/api.md): from the game table when fresher than 7 days, else from BGG. */
export async function gamesRoute(ctx: RouteContext): Promise<Response> {
  const ids = parseIds(ctx.url.searchParams.get('ids'))
  const db = ctx.db()
  const cached = await getCachedGames(db, ids, new Date(ctx.now.getTime() - FRESH_MS).toISOString())
  const have = new Set(cached.map(g => g.bggId))
  const missing = ids.filter(id => !have.has(id))
  const fetched = missing.length > 0 ? await ctx.bgg.getGames(missing) : []
  if (fetched.length > 0) await upsertGames(db, fetched, ctx.now.toISOString())
  const byId = new Map([...cached, ...fetched].map(g => [g.bggId, g]))
  return Response.json({ games: ids.flatMap(id => byId.get(id) ?? []) })
}
