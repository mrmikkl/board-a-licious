import { describe, expect, it } from 'vitest'

import { GALLERY_MAX, type GameImage, orderGallery } from '../../src/domain/gallery.ts'

const img = (id: number, caption: string | null = null): GameImage => ({ id, large: `L${id}`, small: `S${id}`, caption })

describe('orderGallery (data-model "Game gallery")', () => {
  it('moves the main image to the front and keeps BGG order for the rest', () => {
    expect(orderGallery(3, [img(1), img(2), img(3), img(4)]).map(i => i.id)).toEqual([3, 1, 2, 4])
  })

  it('puts the fallback main image first when the main image is not in the page', () => {
    expect(orderGallery(9, [img(1), img(2)], img(9)).map(i => i.id)).toEqual([9, 1, 2])
  })

  it('works without a main image', () => {
    expect(orderGallery(null, [img(1), img(2)]).map(i => i.id)).toEqual([1, 2])
    expect(orderGallery(null, [])).toEqual([])
  })

  it('drops duplicate ids', () => {
    expect(orderGallery(2, [img(1), img(2), img(1), img(3)], img(2)).map(i => i.id)).toEqual([2, 1, 3])
  })

  it(`keeps at most ${GALLERY_MAX} images`, () => {
    const many = Array.from({ length: 80 }, (_, i) => img(i + 1))
    const ordered = orderGallery(70, many)
    expect(GALLERY_MAX).toBe(50)
    expect(ordered).toHaveLength(50)
    expect(ordered[0]?.id).toBe(70)
  })

  it('trims captions to 120 characters and turns empty captions into null', () => {
    const [long, empty, spaces] = orderGallery(null, [img(1, 'x'.repeat(200)), img(2, ''), img(3, '   ')])
    expect(long?.caption).toHaveLength(120)
    expect(empty?.caption).toBeNull()
    expect(spaces?.caption).toBeNull()
  })
})
