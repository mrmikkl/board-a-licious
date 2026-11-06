import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { fixture, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

const xmlFixture = (name: string) => new Response(readFileSync(new URL(`../fixtures/bgg-xml/${name}`, import.meta.url), 'utf8'))

let db: Db
beforeEach(async () => {
  db = await testDb()
})

/** Answers both BGG hosts so a test sees which one the Worker asked. */
const bgg = async (url: URL) => {
  if (url.hostname === 'boardgamegeek.com' && url.pathname === '/xmlapi2/thing') return xmlFixture('thing-295947-385318.xml')
  if (url.hostname === 'boardgamegeek.com' && url.pathname.startsWith('/xmlapi/geeklist/')) return xmlFixture('geeklist-66420.xml')
  if (url.pathname === '/api/geekitems' && url.searchParams.get('objecttype') === 'company') return fixture('company-34183.json')
  if (url.pathname === '/api/geekitems') return fixture('geekitems-295947.json')
  if (url.pathname === '/api/dynamicinfo') return fixture('dynamicinfo-295947.json')
  if (url.pathname === '/api/geeklists/66420') return fixture('geeklist-66420.json')
  if (url.pathname === '/api/listitems') return fixture('geeklist-page-1.json')
  if (url.pathname === '/api/geekpreviews/93') return fixture('preview-93.json')
  if (url.pathname === '/api/geekpreviewitems') return fixture('preview-93-page-1.json')
  if (url.pathname === '/api/images') return fixture('images-295947.json')
  return new Response('null', { status: 404 })
}

const TOKEN = { BGG_TOKEN: 'test-token' }
const hosts = (calls: string[]) => calls.map(c => c.split('/')[2])

describe('BGG source per kind of data (ADR 0007)', () => {
  it('without a token: website data for everything, search unavailable, /api/me says so', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg, bggCalls: calls, fullCalls: true })
    expect((await app('/api/bgg/games?ids=295947')).status).toBe(200)
    expect((await app('/api/bgg/lists/geeklist/66420?page=1')).status).toBe(200)
    expect(hosts(calls).every(h => h === 'api.geekdo.com')).toBe(true)
    expect(await (await app('/api/me')).json()).toMatchObject({ bggSearch: false })
  })

  it('with a token: games and geeklists from the official API, no website request for them', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg, bggCalls: calls, fullCalls: true, env: TOKEN })
    const games = await (await app('/api/bgg/games?ids=295947')).json()
    expect(games.games[0]).toMatchObject({ bggId: 295947, rating: 7.88 })
    expect((await app('/api/bgg/lists/geeklist/66420?page=1')).status).toBe(200)
    expect(hosts(calls)).toEqual(['boardgamegeek.com', 'boardgamegeek.com'])
    const me = await (await app('/api/me')).json()
    expect(me).toEqual({ email: expect.any(String), bggSearch: true })
    expect(JSON.stringify(me)).not.toContain('test-token')
  })

  it('with a token: previews, companies and galleries stay on the website data', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg, bggCalls: calls, fullCalls: true, env: TOKEN })
    expect((await app('/api/bgg/lists/preview/93?page=1')).status).toBe(200)
    expect((await app('/api/bgg/companies?ids=34183')).status).toBe(200)
    expect((await app('/api/bgg/images?id=295947')).status).toBe(200)
    expect(hosts(calls).every(h => h === 'api.geekdo.com')).toBe(true)
  })

  it('a rejected token makes games not reachable, with no website fallback (FR-007)', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg: async () => new Response('Unauthorized', { status: 401 }), bggCalls: calls, fullCalls: true, env: TOKEN })
    const res = await app('/api/bgg/games?ids=295947')
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'bgg_unavailable' })
    expect(JSON.stringify(body)).not.toContain('test-token')
    expect(hosts(calls)).toEqual(['boardgamegeek.com'])
  })
})
