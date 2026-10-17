import { HttpError } from '../http.ts'
import type { RouteContext } from './context.ts'

const MAX_IDS = 10

/** T045: GET /api/bgg/companies?ids=1,2 (contracts/api.md). */
export async function companiesRoute(ctx: RouteContext): Promise<Response> {
  const raw = (ctx.url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const ids = raw.map(Number)
  if (ids.length < 1 || ids.length > MAX_IDS || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new HttpError('bad_request', `ids must be 1 to ${MAX_IDS} company ids.`)
  }
  return Response.json({ companies: await ctx.bgg.getCompanies([...new Set(ids)]) })
}
