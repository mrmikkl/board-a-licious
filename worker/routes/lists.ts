import { errorResponse } from '../http.ts'
import type { RouteContext } from './context.ts'

/** T045: GET /api/bgg/lists/<kind>/<id>?page=<n> (contracts/api.md). */
export async function listsRoute(_ctx: RouteContext, _kind: string, _id: string): Promise<Response> {
  return errorResponse('not_found', 'Not implemented yet (T045).')
}
