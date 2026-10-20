import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { memoryCache } from '../../worker/bgg/cache.ts'
import { GeekdoSource } from '../../worker/bgg/geekdo.ts'
import { fixture, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

let db: Db
beforeEach(async () => {
  db = await testDb()
})

/** Cascadia's geekitem and its game gallery (recorded, research R1); other games are unknown. */
const bgg = async (url: URL) => {
  const id = url.searchParams.get('objectid')
  if (url.pathname === '/api/geekitems' && id === '295947') return fixture('geekitems-295947.json')
  if (url.pathname === '/api/images' && id === '295947') return fixture('images-295947.json')
  return new Response('null', { status: 404 })
}

describe('GET /api/bgg/images (contracts/images-api.md)', () => {
  it('returns the gallery with the main image first, then BGG order', async () => {
    const res = await testApp(db, { bgg })('/api/bgg/images?id=295947')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bggId).toBe(295947)
    expect(body.total).toBe(600)
    expect(body.images.map((i: { id: number }) => i.id)).toEqual([5100691, 7243634, 6339716, 6343948, 7203021, 6871063, 8704862, 5549098])
    expect(body.images[0]).toEqual({
      id: 5100691,
      large: expect.stringMatching(/^https:\/\/cf\.geekdo-images\.com\/.*__large\/.*pic5100691\.jpg$/),
      small: expect.stringMatching(/^https:\/\/cf\.geekdo-images\.com\/.*__small\/.*pic5100691\.jpg$/),
      caption: expect.anything(),
    })
  })

  it("asks BGG's game gallery, sorted hot, 50 per page", async () => {
    const calls: string[] = []
    await testApp(db, { bgg, bggCalls: calls })('/api/bgg/images?id=295947')
    const gallery = calls.find(c => c.startsWith('/api/images'))
    expect(gallery).toBeDefined()
    const params = new URLSearchParams(gallery?.split('?')[1])
    expect(Object.fromEntries(params)).toMatchObject({ objectid: '295947', objecttype: 'thing', gallery: 'game', sort: 'hot', showcount: '50', pageid: '1' })
  })

  it('serves a second call from the cache without asking BGG again (SC-005)', async () => {
    // one source, as in production (the test app builds a new one per request)
    const calls: string[] = []
    const source = new GeekdoSource({
      fetch: async input => (calls.push(String(input)), bgg(new URL(String(input)))),
      cache: memoryCache(() => Date.parse('2026-10-21T12:00:00Z')),
      sleep: async () => {},
    })
    const first = await source.getGallery(295947)
    const again = await source.getGallery(295947)
    expect(again).toEqual(first)
    expect(calls).toHaveLength(2)
  })

  it('rejects a missing or non-positive id', async () => {
    expect((await testApp(db, { bgg })('/api/bgg/images')).status).toBe(400)
    expect((await testApp(db, { bgg })('/api/bgg/images?id=0')).status).toBe(400)
  })

  it('says not found for an unknown game', async () => {
    expect((await testApp(db, { bgg })('/api/bgg/images?id=999999')).status).toBe(404)
  })

  it('passes on that BGG is busy, with Retry-After (as the other BGG routes: 503 bgg_rate_limited)', async () => {
    const busy = async () => new Response('', { status: 429, headers: { 'Retry-After': '30' } })
    const res = await testApp(db, { bgg: busy })('/api/bgg/images?id=295947')
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
