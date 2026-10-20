import { type GameGallery, type GameImage, GALLERY_MAX, orderGallery } from '../../src/domain/gallery.ts'
import { type BggClient, TTL } from './cache.ts'

type GeekItemImages = {
  imageid?: string | number | null
  imageurl?: string | null
  images?: { thumb?: string | null; previewthumb?: string | null } | null
}
type GalleryImage = { imageid: string | number; imageurl_lg?: string | null; imageurl?: string | null; caption?: string | null }
type GalleryPage = { images?: GalleryImage[] | null; pagination?: { total?: number | string } | null }

const toImage = (i: GalleryImage): GameImage | null => {
  const id = Number(i.imageid)
  const large = i.imageurl_lg || i.imageurl
  return Number.isSafeInteger(id) && id > 0 && large ? { id, large, small: i.imageurl || large, caption: i.caption ?? null } : null
}

/**
 * A game's image gallery (research R1, R2): BGG's "game" gallery sorted "hot", one page of GALLERY_MAX, with
 * the game's main image (from its geekitem) first. Public website JSON under constitution V's exception;
 * both requests go through the cached, rate-limited client (7 days, like game details).
 */
export async function getGallery(client: BggClient, bggId: number): Promise<GameGallery> {
  const item = (
    await client.getJson<{ item?: GeekItemImages | null } | null>(`https://api.geekdo.com/api/geekitems?objectid=${bggId}&objecttype=thing`, TTL.game)
  )?.item
  const page = await client.getJson<GalleryPage | null>(
    `https://api.geekdo.com/api/images?ajax=1&gallery=game&nosession=1&objectid=${bggId}&objecttype=thing&pageid=1&showcount=${GALLERY_MAX}&size=thumb&sort=hot`,
    TTL.game,
  )
  const images = (page?.images ?? []).map(toImage).filter((i): i is GameImage => i !== null)
  const mainId = Number(item?.imageid) || null
  const fallbackLarge = item?.imageurl || item?.images?.previewthumb
  const fallback = mainId && fallbackLarge ? { id: mainId, large: fallbackLarge, small: item?.images?.thumb || fallbackLarge, caption: null } : undefined
  const ordered = orderGallery(mainId, images, fallback)
  return { bggId, total: Math.max(Number(page?.pagination?.total) || 0, ordered.length), images: ordered }
}
