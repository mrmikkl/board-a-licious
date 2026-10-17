import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { type FakeBgg, fixture, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

let db: Db
beforeEach(async () => {
  db = await testDb()
})

const notFound = () => new Response('null', { status: 404 })

const bgg: FakeBgg = url => {
  const q = url.searchParams
  if (url.pathname === '/api/geekpreviews/93') return fixture('preview-93.json')
  if (url.pathname === '/api/geekpreviewitems' && q.get('previewid') === '93') {
    return ['1', '138'].includes(q.get('pageid') ?? '') ? fixture(`preview-93-page-${q.get('pageid')}.json`) : Response.json([])
  }
  if (url.pathname === '/api/geeklists/66420') return fixture('geeklist-66420.json')
  if (url.pathname === '/api/listitems' && q.get('listid') === '66420' && q.get('page') === '1') return fixture('geeklist-page-1.json')
  if (url.pathname === '/api/geekitems' && q.get('objecttype') === 'company' && q.get('objectid') === '34183') return fixture('company-34183.json')
  return notFound()
}

describe('GET /api/bgg/lists/preview/<id>', () => {
  it('returns the first page with title, page count and facts', async () => {
    const res = await testApp(db, { bgg })('/api/bgg/lists/preview/93')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, page: 1, pageCount: 138 })
    expect(body.entries).toHaveLength(10)
    expect(body.entries[0]).toEqual({
      position: 1,
      bggId: 446453,
      name: 'Kalypso',
      thumbnailUrl: expect.stringContaining('cf.geekdo-images.com'),
      facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisherId: 34183, publisher: 'Inside Up Games' },
    })
  })

  it('reads the booth as null when missing and the price as null when BGG lists none', async () => {
    const { entries } = await (await testApp(db, { bgg })('/api/bgg/lists/preview/93?page=1')).json()
    expect(entries[1].facts).toEqual({ booth: null, priceCents: 2000, currency: 'USD', publisherId: 10754, publisher: 'Plaid Hat Games' })
    expect(entries[9].facts).toEqual({ booth: '4-E400', priceCents: null, currency: null, publisherId: 54509, publisher: 'Ruse.Games' })
  })

  it('falls back to the msrp when there is no fair price', async () => {
    const { page, entries } = await (await testApp(db, { bgg })('/api/bgg/lists/preview/93?page=138')).json()
    expect(page).toBe(138)
    expect(entries).toHaveLength(6)
    expect(entries[0]).toMatchObject({ position: 1371, bggId: 473368, facts: { booth: '3H110', priceCents: 2600, currency: 'EUR', publisherId: null, publisher: null } })
    expect(entries[1].facts).toMatchObject({ priceCents: 300, currency: 'EUR', publisherId: 30958, publisher: 'Capstone Games' })
  })

  it('answers page 1 without company lookups; publisher null when BGG does not name it', async () => {
    const calls: string[] = []
    const bare: FakeBgg = async url => {
      const res = await bgg(url)
      if (url.pathname !== '/api/geekpreviewitems') return res
      const items = (await res.json()) as Record<string, unknown>[]
      return Response.json(items.map(({ publishers: _, ...item }) => item))
    }
    const { entries } = await (await testApp(db, { bgg: bare, bggCalls: calls })('/api/bgg/lists/preview/93')).json()
    expect(entries[0].facts).toMatchObject({ publisherId: 34183, publisher: null })
    expect(calls).toEqual(['/api/geekpreviews/93', '/api/geekpreviewitems?previewid=93&pageid=1'])
  })

  it('answers 404 for an unknown preview', async () => {
    const res = await testApp(db, { bgg })('/api/bgg/lists/preview/999999')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'not_found' })
  })

  it('answers 502 when BGG fails', async () => {
    const res = await testApp(db, { bgg: () => new Response('oops', { status: 500 }) })('/api/bgg/lists/preview/93')
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'bgg_unavailable', retryable: true })
  })
})

describe('GET /api/bgg/lists/geeklist/<id>', () => {
  it('returns games only, without facts', async () => {
    const res = await testApp(db, { bgg })('/api/bgg/lists/geeklist/66420')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      kind: 'geeklist',
      id: 66420,
      title: 'MetaList for GeekList AUCTIONS',
      isEssen: false,
      page: 1,
      pageCount: 1,
      entries: [
        { position: 12, bggId: 180263, name: 'The 7th Continent', thumbnailUrl: expect.stringContaining('cf.geekdo-images.com') },
        { position: 14, bggId: 269420, name: 'Ragemore', thumbnailUrl: expect.stringContaining('cf.geekdo-images.com') },
      ],
    })
  })

  it('asks BGG for the list and the page', async () => {
    const calls: string[] = []
    await testApp(db, { bgg, bggCalls: calls })('/api/bgg/lists/geeklist/66420?page=1')
    expect(calls).toEqual(['/api/geeklists/66420', '/api/listitems?listid=66420&page=1'])
  })

  it('answers 404 for an unknown geeklist', async () => {
    expect((await testApp(db, { bgg })('/api/bgg/lists/geeklist/999999999')).status).toBe(404)
  })
})

describe('list parameters', () => {
  it.each(['/api/bgg/lists/wishlist/93', '/api/bgg/lists/preview/0', '/api/bgg/lists/preview/abc', '/api/bgg/lists/preview/93?page=0', '/api/bgg/lists/preview/93?page=x'])(
    'rejects %s with 400',
    async path => {
      const res = await testApp(db, { bgg })(path)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'bad_request' })
    },
  )
})

describe('GET /api/bgg/companies', () => {
  it('returns publisher names and leaves out unknown companies', async () => {
    const calls: string[] = []
    const res = await testApp(db, { bgg, bggCalls: calls })('/api/bgg/companies?ids=34183,999999999')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ companies: [{ id: 34183, name: 'Inside Up Games' }] })
    expect(calls[0]).toBe('/api/geekitems?objectid=34183&objecttype=company')
  })

  it.each(['', 'ids=', 'ids=0', 'ids=abc', `ids=${Array.from({ length: 11 }, (_, i) => i + 1).join(',')}`])('rejects %s with 400', async query => {
    expect((await testApp(db, { bgg })(`/api/bgg/companies?${query}`)).status).toBe(400)
  })
})
