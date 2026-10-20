import { HttpError } from '../http.ts'
import type { RouteContext } from './context.ts'

/** GET /api/bgg/images?id=<bggId> (contracts/images-api.md): the game's gallery, main image first. */
export async function imagesRoute(ctx: RouteContext): Promise<Response> {
  const id = Number(ctx.url.searchParams.get('id'))
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError('bad_request', 'id must be a positive whole number.')
  return Response.json(await ctx.bgg.getGallery(id))
}
