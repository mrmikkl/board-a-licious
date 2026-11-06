import { searchQuery } from '../../src/domain/bgg-search.ts'
import { HttpError } from '../http.ts'
import type { RouteContext } from './context.ts'

const MAX_LIMIT = 50

/** F006: GET /api/bgg/search?q=<text>&limit=<n> (contracts/api.md); BGG's answer is cached a day per text. */
export async function searchRoute(ctx: RouteContext): Promise<Response> {
  const query = searchQuery(ctx.url.searchParams.get('q') ?? '')
  if (!query.ok) throw new HttpError('bad_request', 'q must be 2–100 characters.')
  const rawLimit = ctx.url.searchParams.get('limit')
  const limit = rawLimit === null ? MAX_LIMIT : /^\d+$/.test(rawLimit) ? Number(rawLimit) : 0
  if (limit < 1 || limit > MAX_LIMIT) throw new HttpError('bad_request', `limit must be 1–${MAX_LIMIT}.`)
  return Response.json({ query: query.text, results: await ctx.bgg.search(query.text, limit) })
}
