import type { BggCollectionAnswer } from '../../src/domain/bgg-status.ts'
import { HttpError } from '../http.ts'
import type { RouteContext } from './context.ts'

/** BGG usernames: 1–50 letters, digits, `_`, `-`, `.` or spaces. */
const USER = /^[A-Za-z0-9_. -]{1,50}$/

/** F008 T009: GET /api/bgg/collection?user=<bggUser>[&fresh=1] (contracts/api.md); any public collection. */
export async function collectionRoute(ctx: RouteContext): Promise<Response> {
  const user = ctx.url.searchParams.get('user') ?? ''
  if (!USER.test(user)) throw new HttpError('bad_request', 'user must be a BoardGameGeek username (1–50 letters, digits, _, -, . or spaces).')
  const fresh = ctx.url.searchParams.get('fresh') === '1'
  const items = await ctx.bgg.getCollection(user, { fresh })
  const answer: BggCollectionAnswer = { bggUser: user.toLowerCase(), loadedAt: ctx.now.toISOString(), items }
  return Response.json(answer)
}
