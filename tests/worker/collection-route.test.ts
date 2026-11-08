import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

const xmlFixture = (name: string, status = 200) =>
  new Response(readFileSync(new URL(`../fixtures/bgg-xml/${name}`, import.meta.url), 'utf8'), { status, headers: { 'Content-Type': 'text/xml' } })

let db: Db
beforeEach(async () => {
  db = await testDb()
})

const recorded = (url: URL) =>
  url.pathname === '/xmlapi2/collection'
    ? xmlFixture(url.searchParams.get('subtype') === 'boardgameexpansion' ? 'collection-expansions.xml' : 'collection-games.xml')
    : new Response('', { status: 404 })

const TOKEN = { BGG_TOKEN: 'test-token' }
const NOW = '2026-11-08T18:00:00.000Z'

describe('GET /api/bgg/collection (F008 contracts/api.md)', () => {
  it('answers the collection with the user lower-cased and the load time', async () => {
    const app = testApp(db, { bgg: recorded, env: TOKEN, now: NOW })
    const res = await app('/api/bgg/collection?user=MrMikkl')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ bggUser: 'mrmikkl', loadedAt: NOW })
    expect(body.items).toHaveLength(26)
    expect(body.items[0]).toEqual({
      bggId: expect.any(Number),
      name: expect.any(String),
      year: expect.any(Number),
      thumbnailUrl: expect.any(String),
      kind: 'boardgame',
      status: expect.objectContaining({ own: expect.any(Boolean), wishlist: null }),
    })
  })

  it('rejects a missing or invalid user with 400 and asks BGG nothing', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg: recorded, bggCalls: calls, env: TOKEN })
    for (const query of ['', '?user=', `?user=${'a'.repeat(51)}`, '?user=anna%2Fx', '?user=anna%26own%3D1', '?user=%3Cb%3E']) {
      const res = await app(`/api/bgg/collection${query}`)
      expect(res.status, query).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'bad_request' })
    }
    expect(calls).toEqual([])
    expect((await app(`/api/bgg/collection?user=${encodeURIComponent('Anna_M-e.ple 2')}`)).status).toBe(200)
    expect((await app(`/api/bgg/collection?user=${'a'.repeat(50)}`)).status).toBe(200)
  })

  it('answers 202 bgg_preparing with Retry-After while BGG prepares the collection', async () => {
    const app = testApp(db, { bgg: () => xmlFixture('collection-queued.xml', 202), env: TOKEN })
    const res = await app('/api/bgg/collection?user=anna')
    expect(res.status).toBe(202)
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(await res.json()).toMatchObject({ error: 'bgg_preparing', retryable: true })
  })

  it('answers 404 not_found for an unknown user', async () => {
    const app = testApp(db, { bgg: () => xmlFixture('collection-unknown-user.xml'), env: TOKEN })
    const res = await app('/api/bgg/collection?user=nobody_here')
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ error: 'not_found' })
  })

  it('serves a repeated read from the cache; fresh=1 asks BGG again', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg: recorded, bggCalls: calls, env: TOKEN })
    await app('/api/bgg/collection?user=anna')
    await app('/api/bgg/collection?user=anna')
    expect(calls).toHaveLength(2)
    expect((await app('/api/bgg/collection?user=anna&fresh=1')).status).toBe(200)
    expect(calls).toHaveLength(4)
  })

  it('is unavailable without the token (no website fallback)', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg: recorded, bggCalls: calls })
    const res = await app('/api/bgg/collection?user=anna')
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ error: 'bgg_unavailable' })
    expect(calls).toEqual([])
  })
})
