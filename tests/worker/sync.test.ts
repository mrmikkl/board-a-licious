import { beforeEach, describe, expect, it } from 'vitest'

import type { Collection, Entry } from '../../src/domain/collection.ts'
import type { Db } from '../../worker/db/db.ts'
import { json, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const collection: Collection = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Essen 2026',
  type: 'essen',
  updatedAt: T1,
  deleted: false,
}
const entry: Entry = {
  collectionId: collection.id,
  bggId: 446453,
  mark: 'must_have',
  bought: false,
  paidCents: null,
  paidCurrency: null,
  facts: null,
  factsSource: null,
  detailsPending: true,
  updatedAt: T1,
  deleted: false,
}

let db: Db
beforeEach(async () => {
  db = await testDb()
})

describe('/api/sync', () => {
  it('rejects requests without a signed-in user', async () => {
    const res = await testApp(db, { email: null })('/api/sync')
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'unauthenticated' })
  })

  it('pushes changes and returns { applied, ignored }; idempotent', async () => {
    const call = testApp(db)
    const body = { collections: [collection], entries: [entry] }
    const first = await call('/api/sync', json(body))
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ applied: 2, ignored: 0 })
    expect(await (await call('/api/sync', json(body))).json()).toEqual({ applied: 0, ignored: 2 })
  })

  it('pulls everything, or only changes after since, with serverTime', async () => {
    const call = testApp(db)
    await call('/api/sync', json({ collections: [collection], entries: [entry] }))
    const all = await (await call('/api/sync')).json()
    expect(all).toEqual({ collections: [collection], entries: [entry], serverTime: '2026-10-17T12:00:00.000Z' })
    const since = await (await call(`/api/sync?since=${encodeURIComponent('2026-10-17T09:30:00.000Z')}`)).json()
    expect(since).toMatchObject({ collections: [], entries: [] })
  })

  it.each([
    ['empty body', { collections: [], entries: [] }],
    ['more than 500 items', { collections: [], entries: Array.from({ length: 501 }, (_, i) => ({ ...entry, bggId: i + 1 })) }],
    ['unknown mark', { collections: [collection], entries: [{ ...entry, mark: 'loved' }] }],
    ['bggId 0', { collections: [collection], entries: [{ ...entry, bggId: 0 }] }],
    ['bad currency', { collections: [collection], entries: [{ ...entry, paidCents: 100, paidCurrency: 'euro' }] }],
    ['name too long', { collections: [{ ...collection, name: 'x'.repeat(61) }], entries: [] }],
    ['far future', { collections: [{ ...collection, updatedAt: '2026-10-17T12:06:00.000Z' }], entries: [] }],
    ['not JSON', 'nope'],
  ])('rejects %s with 400 bad_request', async (_, body) => {
    const res = await testApp(db)('/api/sync', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'bad_request', retryable: false })
  })

  it("rejects entries for another user's collection", async () => {
    await testApp(db)('/api/sync', json({ collections: [collection], entries: [] }))
    const res = await testApp(db, { email: 'ben@example.com' })('/api/sync', json({ collections: [], entries: [entry] }))
    expect(res.status).toBe(400)
  })

  it('returns the user and search availability on /api/me', async () => {
    expect(await (await testApp(db)('/api/me')).json()).toEqual({ email: 'anna@example.com', bggSearch: false })
  })
})
