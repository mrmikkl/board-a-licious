import { errorResponse } from '../http.ts'
import type { RouteContext } from './context.ts'

/** T045: GET /api/bgg/companies?ids=1,2 (contracts/api.md). */
export async function companiesRoute(_ctx: RouteContext): Promise<Response> {
  return errorResponse('not_found', 'Not implemented yet (T045).')
}
