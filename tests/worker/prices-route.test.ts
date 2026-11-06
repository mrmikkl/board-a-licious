import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

const fixture = (name: string) => new Response(readFileSync(new URL(`../fixtures/prices/${name}`, import.meta.url), 'utf8'))
const TOKEN = { BGG_TOKEN: 'test-token' }

let db: Db
beforeEach(async () => {
  db = await testDb()
})

/** Every price source answers from its fixture; `override` replaces one host's answer. */
const sources = (override: Record<string, () => Response | Promise<Response>> = {}) => async (url: URL) => {
  const own = override[url.hostname]
  if (own) return own()
  if (url.hostname === 'brettspielpreise.de') return fixture('brettspielpreise-295947.json')
  if (url.hostname === 'www.ecb.europa.eu') return fixture('ecb-daily.xml')
  if (url.hostname === 'unknowns.de') return fixture('unknowns-feed.xml')
  if (url.hostname === 'boardgamegeek.com') return fixture('bgg-market-295947.xml')
  return new Response('', { status: 404 })
}

describe('GET /api/prices (F007 contracts/api.md)', () => {
  it('answers new and used offers, the links and the sources', async () => {
    const res = await testApp(db, { bgg: sources(), env: TOKEN })('/api/prices?bggId=295947&name=Cascadia')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ bggId: 295947, failed: [], sources: ['brettspielpreise.de', 'BGG marketplace', 'unknowns.de'] })
    expect(body.siteSearch).toBe('https://brettspielpreise.de/item/search?search=Cascadia')
    expect(body.offers.some((o: { kind: string }) => o.kind === 'new')).toBe(true)
    expect(body.offers.filter((o: { source: string }) => o.source === 'bgg').length).toBeGreaterThan(0)
    expect(body.offers.filter((o: { source: string }) => o.source === 'unknowns')).toHaveLength(1)
    expect(body.links.map((l: { name: string }) => l.name)).toEqual(['Kleinanzeigen', 'eBay.de', 'unknowns.de'])
    expect(typeof body.checkedAt).toBe('string')
  })

  it('checks bggId (a positive integer) and name (1–100 characters)', async () => {
    const app = testApp(db, { bgg: sources(), env: TOKEN })
    for (const query of ['', 'bggId=0&name=X', 'bggId=x&name=X', 'bggId=1', 'bggId=1&name=', `bggId=1&name=${'x'.repeat(101)}`]) {
      expect((await app(`/api/prices?${query}`)).status, query).toBe(400)
    }
  })

  it('names a failing source and still answers with the others', async () => {
    const res = await testApp(db, { bgg: sources({ 'brettspielpreise.de': () => new Response('', { status: 500 }) }), env: TOKEN })('/api/prices?bggId=295947&name=Cascadia')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.failed).toEqual(['brettspielpreise.de'])
    expect(body.offers.every((o: { kind: string }) => o.kind === 'used')).toBe(true)
  })

  it('without the BGG token has no marketplace offers and makes no BGG request', async () => {
    const calls: string[] = []
    const body = await (await testApp(db, { bgg: sources(), bggCalls: calls, fullCalls: true })('/api/prices?bggId=295947&name=Cascadia')).json()
    expect(body.offers.filter((o: { source: string }) => o.source === 'bgg')).toEqual([])
    expect(calls.some(c => c.includes('boardgamegeek.com'))).toBe(false)
  })

  it('asks the sources once within an hour', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg: sources(), bggCalls: calls, fullCalls: true, env: TOKEN })
    await app('/api/prices?bggId=295947&name=Cascadia')
    const first = calls.length
    await app('/api/prices?bggId=295947&name=Cascadia')
    expect(calls.length).toBe(first)
  })
})
