import { errorResponse } from '../http.ts'
import type { RouteContext } from './context.ts'

/** T030: GET /api/bgg/games?ids=1,2 (contracts/api.md). */
export async function gamesRoute(_ctx: RouteContext): Promise<Response> {
  return errorResponse('not_found', 'Not implemented yet (T030).')
}
