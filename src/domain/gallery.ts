/** One picture of a game from BoardGameGeek (data-model "Game image"). */
export type GameImage = { id: number; large: string; small: string; caption: string | null }

/** A game's gallery as the app gets it: main image first, at most GALLERY_MAX (contracts/images-api.md). */
export type GameGallery = { bggId: number; total: number; images: GameImage[] }

/** The spec's cap: plenty to get an impression of a game at the fair. */
export const GALLERY_MAX = 50
const CAPTION_MAX = 120

/**
 * Main image first (the one the user tapped as the cover), then BGG's own order; a missing main image is
 * replaced by `fallbackMain`; duplicates dropped; at most GALLERY_MAX; captions trimmed (research R2).
 */
export function orderGallery(mainImageId: number | null, images: GameImage[], fallbackMain?: GameImage): GameImage[] {
  const main = images.find(i => i.id === mainImageId) ?? (mainImageId != null ? fallbackMain : undefined)
  const seen = new Set<number>()
  const ordered: GameImage[] = []
  for (const image of main ? [main, ...images] : images) {
    if (seen.has(image.id)) continue
    seen.add(image.id)
    const caption = image.caption?.trim().slice(0, CAPTION_MAX) || null
    ordered.push({ ...image, caption })
    if (ordered.length === GALLERY_MAX) break
  }
  return ordered
}
