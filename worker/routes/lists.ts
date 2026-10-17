import { HttpError } from '../http.ts'
import type { RouteContext } from './context.ts'

const positive = (value: string) => (/^\d+$/.test(value) && Number(value) > 0 ? Number(value) : null)

/** T045: GET /api/bgg/lists/<kind>/<id>?page=<n> (contracts/api.md). */
export async function listsRoute(ctx: RouteContext, kind: string, id: string): Promise<Response> {
  if (kind !== 'preview' && kind !== 'geeklist') throw new HttpError('bad_request', 'The list kind must be "preview" or "geeklist".')
  const listId = positive(id)
  if (listId === null) throw new HttpError('bad_request', 'The list id must be a positive whole number.')
  const page = positive(ctx.url.searchParams.get('page') ?? '1')
  if (page === null) throw new HttpError('bad_request', 'page must be 1 or more.')
  return Response.json(await ctx.bgg.getListPage(kind, listId, page))
}
