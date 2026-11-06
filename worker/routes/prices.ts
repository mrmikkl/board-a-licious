import type { Offer, PricesAnswer } from '../../src/domain/offers.ts'
import { HttpError } from '../http.ts'
import { getNewOffers, searchUrl } from '../prices/brettspielpreise.ts'
import { getRates } from '../prices/ecb.ts'
import { priceLinks } from '../prices/links.ts'
import { getUnknownsOffers } from '../prices/unknowns.ts'
import type { RouteContext } from './context.ts'

/** No source may hold up the answer longer than this (spec: about 10 s at most). */
const SOURCE_TIMEOUT_MS = 8000

function inTime<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('too slow')), SOURCE_TIMEOUT_MS)
  })
  return Promise.race([work, late]).finally(() => clearTimeout(timer))
}

/**
 * F007: GET /api/prices?bggId=&name= (contracts/api.md): all allowed sources in parallel (ADR 0008); a
 * source that fails or is too slow is named in `failed` and the others still answer (FR-008).
 */
export async function pricesRoute(ctx: RouteContext): Promise<Response> {
  const bggId = Number(ctx.url.searchParams.get('bggId'))
  const name = (ctx.url.searchParams.get('name') ?? '').trim()
  if (!Number.isSafeInteger(bggId) || bggId <= 0) throw new HttpError('bad_request', 'bggId must be a positive integer.')
  if (name.length < 1 || name.length > 100) throw new HttpError('bad_request', 'name must be 1–100 characters.')

  // the exchange rates only refine non-euro marketplace prices: without them those have no euro total
  const rates = () => getRates(ctx.prices).catch(() => ({}))
  const sources: [string, () => Promise<Offer[]>][] = [
    ['brettspielpreise.de', () => getNewOffers(ctx.prices, bggId)],
    ['BGG marketplace', async () => ctx.bgg.getMarketOffers(bggId, await rates())],
    ['unknowns.de', () => getUnknownsOffers(ctx.prices, name)],
  ]
  const results = await Promise.allSettled(sources.map(([, read]) => inTime(read())))
  const answer: PricesAnswer = {
    bggId,
    checkedAt: ctx.now.toISOString(),
    sources: sources.map(([source]) => source),
    failed: sources.flatMap(([source], i) => (results[i]!.status === 'rejected' ? [source] : [])),
    offers: results.flatMap(r => (r.status === 'fulfilled' ? r.value : [])),
    links: priceLinks(name),
    siteSearch: searchUrl(name),
  }
  return Response.json(answer)
}
