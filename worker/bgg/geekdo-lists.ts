import { BggError, type BggClient, TTL } from './cache.ts'
import { type GeekItemInfo, gameDetails } from './geekdo-games.ts'
import type { ListEntry, ListFacts, ListKind, ListPage } from './source.ts'

const BASE = 'https://api.geekdo.com/api'

type PreviewInfo = { title: string; config?: { numpages?: number; showcount?: number } }

type PreviewItem = {
  objecttype: string
  objectid: string
  location?: string | null
  showprice?: number | string | null
  showprice_currency?: string | null
  msrp?: number | string | null
  msrp_currency?: string | null
  links?: { objecttype: string; objectid: string }[]
  publishers?: { item?: { objectid?: number | string; primaryname?: { name?: string } } }[]
  thumbnail?: { src?: string }
  geekitem?: { item?: GeekItemInfo & { primaryname?: { name?: string }; images?: { square200?: string; thumb?: string } } }
  version?: { item?: { versionname?: string; primaryname?: { name?: string } } } | null
}

type GeeklistInfo = { name: string }

type GeeklistItems = {
  data: { item: { type: string; id: string; name: string; href?: string; imageSets?: { square100?: { src?: string } } } }[]
  pagination: { perPage: number; total: number }
}

/** A price in whole currency units as cents, or null for none (BGG uses 0 for "not given"). */
function cents(amount: unknown): number | null {
  const value = Number(amount)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null
}

/** Booth, price (fair price, else msrp), publisher and edition; the name only when BGG embeds it (no lookups). */
function previewFacts(item: PreviewItem): ListFacts {
  const show = cents(item.showprice)
  const msrp = cents(item.msrp)
  const price =
    show !== null
      ? { priceCents: show, currency: item.showprice_currency || null }
      : { priceCents: msrp, currency: msrp !== null ? item.msrp_currency || null : null }
  const companyId = item.links?.find(l => l.objecttype === 'company')?.objectid
  const publisherId = companyId ? Number(companyId) : null
  const named = item.publishers?.find(p => Number(p.item?.objectid) === publisherId)?.item?.primaryname?.name
  const version = item.version?.item
  const edition = (version?.versionname || version?.primaryname?.name)?.trim() || null
  return { booth: item.location?.trim() || null, ...price, publisherId, publisher: publisherId !== null ? (named ?? null) : null, edition }
}

async function previewPage(client: BggClient, id: number, page: number): Promise<ListPage> {
  const info = await client.getJson<PreviewInfo>(`${BASE}/geekpreviews/${id}`, TTL.list)
  const pageCount = Math.max(1, info.config?.numpages ?? 1)
  const perPage = info.config?.showcount ?? 10
  const items = page > pageCount ? [] : await client.getJson<PreviewItem[]>(`${BASE}/geekpreviewitems?previewid=${id}&pageid=${page}`, TTL.list)
  const entries: ListEntry[] = []
  items.forEach((item, i) => {
    if (item.objecttype !== 'thing') return
    const game = item.geekitem?.item
    entries.push({
      position: (page - 1) * perPage + i + 1,
      bggId: Number(item.objectid),
      name: game?.primaryname?.name ?? '',
      thumbnailUrl: game?.images?.square200 ?? game?.images?.thumb ?? item.thumbnail?.src ?? null,
      facts: previewFacts(item),
      info: (({ publisher: _, ...info }) => info)(gameDetails(game)),
    })
  })
  return { kind: 'preview', id, title: info.title, page, pageCount, entries }
}

const GAME_HREF = /^\/boardgame(expansion)?\//

async function geeklistPage(client: BggClient, id: number, page: number): Promise<ListPage> {
  const info = await client.getJson<GeeklistInfo>(`${BASE}/geeklists/${id}`, TTL.list)
  const items = await client.getJson<GeeklistItems>(`${BASE}/listitems?listid=${id}&page=${page}`, TTL.list)
  const perPage = items.pagination.perPage || 25
  const entries: ListEntry[] = []
  items.data.forEach(({ item }, i) => {
    // geeklists also hold threads, other geeklists, RPGs and video games: only board games count
    if (item.type !== 'things' || !GAME_HREF.test(item.href ?? '')) return
    entries.push({ position: (page - 1) * perPage + i + 1, bggId: Number(item.id), name: item.name, thumbnailUrl: item.imageSets?.square100?.src ?? null })
  })
  const pageCount = Math.max(1, Math.ceil(items.pagination.total / perPage))
  return { kind: 'geeklist', id, title: info.name, page, pageCount, entries }
}

/** T045: one page of a preview (`api/geekpreviewitems`) or a geeklist (`api/listitems`), research R9. */
export async function getListPage(client: BggClient, kind: ListKind, id: number, page: number): Promise<ListPage> {
  return kind === 'preview' ? previewPage(client, id, page) : geeklistPage(client, id, page)
}

/** T045: publisher names from `api/geekitems?objectid=<id>&objecttype=company`; unknown ones left out. */
export async function getCompanies(client: BggClient, ids: number[]): Promise<{ id: number; name: string }[]> {
  const companies: { id: number; name: string }[] = []
  for (const id of ids) {
    try {
      const body = await client.getJson<{ item?: { name?: string } } | null>(`${BASE}/geekitems?objectid=${id}&objecttype=company`, TTL.company)
      if (body?.item?.name) companies.push({ id, name: body.item.name })
    } catch (error) {
      if (!(error instanceof BggError && error.code === 'not_found')) throw error
    }
  }
  return companies
}
