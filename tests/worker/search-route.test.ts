import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, it } from 'vitest'

import type { Db } from '../../worker/db/db.ts'
import { testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

const search = () => new Response(readFileSync(new URL('../fixtures/bgg-xml/search-cascad.xml', import.meta.url), 'utf8'))
const TOKEN = { BGG_TOKEN: 'test-token' }

let db: Db
beforeEach(async () => {
  db = await testDb()
})

describe('GET /api/bgg/search (F006 contracts/api.md)', () => {
  it('answers the ranked results, at most limit (default 50)', async () => {
    const app = testApp(db, { bgg: search, env: TOKEN })
    const res = await app('/api/bgg/search?q=cascad')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.query).toBe('cascad')
    expect(body.results).toHaveLength(25)
    expect(body.results[0]).toEqual({ bggId: expect.any(Number), name: 'Cascade', year: expect.any(Number), kind: 'boardgame' })
    const eight = await (await app('/api/bgg/search?q=cascad&limit=8')).json()
    expect(eight.results).toHaveLength(8)
  })

  it('checks q (2–100 characters after trimming) and limit (1–50)', async () => {
    const app = testApp(db, { bgg: search, env: TOKEN })
    for (const query of ['q=a', 'q=%20%20', `q=${'x'.repeat(101)}`, 'q=ab&limit=0', 'q=ab&limit=51', 'q=ab&limit=x', '']) {
      const res = await app(`/api/bgg/search?${query}`)
      expect(res.status, query).toBe(400)
    }
  })

  it('is unavailable without a token, not retryable', async () => {
    const res = await testApp(db, { bgg: search })('/api/bgg/search?q=cascad')
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ error: 'bgg_search_unavailable', retryable: false })
  })

  it('passes BGG failures on: not reachable, and asked to wait with Retry-After', async () => {
    const down = await testApp(db, { bgg: () => new Response('', { status: 500 }), env: TOKEN })('/api/bgg/search?q=cascad')
    expect(down.status).toBe(502)
    expect(await down.json()).toMatchObject({ error: 'bgg_unavailable' })
    const busy = await testApp(db, { bgg: () => new Response('', { status: 429, headers: { 'Retry-After': '7' } }), env: TOKEN })('/api/bgg/search?q=cascad')
    expect(busy.status).toBe(503)
    expect(busy.headers.get('Retry-After')).toBe('7')
  })

  it('asks BGG once for the same search within a day', async () => {
    const calls: string[] = []
    const app = testApp(db, { bgg: search, bggCalls: calls, env: TOKEN })
    await app('/api/bgg/search?q=Cascad')
    await app('/api/bgg/search?q=%20cascad%20')
    expect(calls).toHaveLength(1)
  })
})
