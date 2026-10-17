import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { upsertGames } from '../../worker/db/repository.ts'
import { fixture, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

let db: Db
beforeEach(async () => {
  db = await testDb()
})

const bgg = async (url: URL) =>
  url.pathname === '/api/geekitems' && url.searchParams.get('objectid') === '295947'
    ? fixture('geekitems-295947.json')
    : new Response('null', { status: 404 })

describe('GET /api/bgg/games', () => {
  it('returns name, year, thumbnail and short description from BGG', async () => {
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
        },
      ],
    })
  })

  it('asks BGG with the game id and object type thing', async () => {
    const calls: string[] = []
    await testApp(db, { bgg, bggCalls: calls })('/api/bgg/games?ids=295947')
    expect(calls).toEqual(['/api/geekitems?objectid=295947&objecttype=thing'])
  })

  it('serves games from the game table when fresher than 7 days, and stores what it fetched', async () => {
    const calls: string[] = []
    await upsertGames(db, [{ bggId: 1, name: 'Cached', year: 2020, thumbnailUrl: null, description: null, kind: 'boardgame' }], '2026-10-15T00:00:00.000Z')
    const res = await testApp(db, { bgg, bggCalls: calls })('/api/bgg/games?ids=1,295947')
    expect((await res.json()).games.map((g: { name: string }) => g.name)).toEqual(['Cached', 'Cascadia'])
    expect(calls).toHaveLength(1)
    const again: string[] = []
    await testApp(db, { bgg, bggCalls: again })('/api/bgg/games?ids=295947')
    expect(again).toEqual([])
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
