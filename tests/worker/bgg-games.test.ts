import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { upsertGames } from '../../worker/db/repository.ts'
import { fixture, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

let db: Db
beforeEach(async () => {
  db = await testDb()
})

const bgg = async (url: URL) => {
  if (url.pathname === '/api/geekitems' && url.searchParams.get('objectid') === '295947') return fixture('geekitems-295947.json')
  if (url.pathname === '/api/dynamicinfo' && url.searchParams.get('objectid') === '295947') return fixture('dynamicinfo-295947.json')
  return new Response('null', { status: 404 })
}

describe('GET /api/bgg/games', () => {
  it('returns name, year, thumbnail, short description, players, designers, mechanisms, first publisher and ratings', async () => {
    const res = await testApp(db, { bgg })('/api/bgg/games?ids=295947')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      games: [
        {
          bggId: 295947,
          name: 'Cascadia',
          year: 2021,
          thumbnailUrl: expect.stringContaining('cf.geekdo-images.com'),
          description: 'Create the most harmonious ecosystem as you puzzle together habitats and wildlife.',
          kind: 'boardgame',
          minPlayers: 1,
          maxPlayers: 4,
          designers: ['Randy Flynn'],
          mechanisms: expect.arrayContaining(['Hexagon Grid', 'Tile Placement']),
          publisher: 'Flatout Games',
          rating: 7.88,
          geekRating: 7.73,
        },
      ],
    })
  })

  it('fetches at most 10 games from BGG per request and leaves the rest for later', async () => {
    const calls: string[] = []
    const ids = Array.from({ length: 12 }, (_, i) => 900001 + i)
    const res = await testApp(db, { bgg, bggCalls: calls })(`/api/bgg/games?ids=${ids.join(',')}`)
    expect(res.status).toBe(200)
    expect(calls).toHaveLength(10)
  })

  it('asks BGG with the game id and object type thing, for the details and then the ratings', async () => {
    const calls: string[] = []
    await testApp(db, { bgg, bggCalls: calls })('/api/bgg/games?ids=295947')
    expect(calls).toEqual([
      '/api/geekitems?objectid=295947&objecttype=thing',
      '/api/dynamicinfo?objectid=295947&objecttype=thing',
    ])
  })

  it('serves games from the game table when fresher than 7 days, and stores what it fetched', async () => {
    const calls: string[] = []
    await upsertGames(db, [{ bggId: 1, name: 'Cached', year: 2020, thumbnailUrl: null, description: null, kind: 'boardgame', minPlayers: null, maxPlayers: null, designers: [], mechanisms: [], publisher: null }], '2026-10-15T00:00:00.000Z')
    const res = await testApp(db, { bgg, bggCalls: calls })('/api/bgg/games?ids=1,295947')
    expect((await res.json()).games.map((g: { name: string }) => g.name)).toEqual(['Cached', 'Cascadia'])
    expect(calls).toHaveLength(2)
    const again: string[] = []
    await testApp(db, { bgg, bggCalls: again })('/api/bgg/games?ids=295947')
    expect(again).toEqual([])
  })

  it('stores the ratings with the game and reads them back from the game table', async () => {
    await testApp(db, { bgg })('/api/bgg/games?ids=295947')
    const calls: string[] = []
    const res = await testApp(db, { bgg: () => new Response('null', { status: 500 }), bggCalls: calls })('/api/bgg/games?ids=295947')
    expect(calls).toEqual([])
    expect(await res.json()).toMatchObject({ games: [{ bggId: 295947, rating: 7.88, geekRating: 7.73 }] })
  })

  it.each([
    ['baverage "0"', { average: '7.88051', baverage: '0' }, 7.88, null],
    ['a stats block without numbers', {}, null, null],
    ['negative values', { average: '-1', baverage: '-2' }, null, null],
  ])('leaves a rating out when BGG has %s', async (_, stats, rating, geekRating) => {
    const res = await testApp(db, {
      bgg: async url =>
        url.pathname === '/api/dynamicinfo'
          ? new Response(JSON.stringify({ item: { stats } }), { headers: { 'Content-Type': 'application/json' } })
          : bgg(url),
    })('/api/bgg/games?ids=295947')
    expect((await res.json()).games[0]).toMatchObject({ rating, geekRating })
  })

  it('still returns the game with null ratings when BGG has no dynamic info for it', async () => {
    const res = await testApp(db, {
      bgg: async url => (url.pathname === '/api/dynamicinfo' ? new Response('null', { status: 404 }) : bgg(url)),
    })('/api/bgg/games?ids=295947')
    expect(res.status).toBe(200)
    expect((await res.json()).games[0]).toMatchObject({ name: 'Cascadia', rating: null, geekRating: null })
  })

  it('answers bgg_unavailable when the ratings are unavailable (503)', async () => {
    const res = await testApp(db, {
      bgg: async url => (url.pathname === '/api/dynamicinfo' ? new Response('', { status: 503 }) : bgg(url)),
    })('/api/bgg/games?ids=295947')
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'bgg_unavailable', retryable: true })
  })

  it('leaves out games BGG does not know', async () => {
    expect(await (await testApp(db, { bgg })('/api/bgg/games?ids=999999999')).json()).toEqual({ games: [] })
  })

  it.each(['', 'ids=', 'ids=0', 'ids=abc', `ids=${Array.from({ length: 51 }, (_, i) => i + 1).join(',')}`])(
    'rejects %s with 400',
    async query => {
      expect((await testApp(db, { bgg })(`/api/bgg/games?${query}`)).status).toBe(400)
    },
  )

  it('answers bgg_unavailable when BGG fails', async () => {
    const res = await testApp(db, { bgg: () => new Response('', { status: 500 }) })('/api/bgg/games?ids=295947')
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'bgg_unavailable', retryable: true })
  })
})
