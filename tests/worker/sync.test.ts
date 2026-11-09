import { beforeEach, describe, expect, it } from 'vitest'

import type { Collection, Entry } from '../../src/domain/collection.ts'
import type { Db } from '../../worker/db/db.ts'
import { json, testApp } from './app-helpers.ts'
import { testDb } from './db-helpers.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const collection: Collection = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Essen 2026',
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
    expect(all).toEqual({ collections: [collection], entries: [entry], lists: [], settings: [], follows: [], serverTime: expect.any(String) })
    // serverTime is the server's own clock (a few seconds back), not the device's
    expect(Date.parse(all.serverTime)).toBeLessThan(Date.now())
    const later = await (await call(`/api/sync?since=${encodeURIComponent('2999-01-01T00:00:00.000Z')}`)).json()
    expect(later).toMatchObject({ collections: [], entries: [] })
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

  it('syncs the loaded BGG lists and rejects invalid ones', async () => {
    const call = testApp(db)
    const spiel = { kind: 'preview', id: 93, title: 'SPIEL Essen 2026', updatedAt: T1, deleted: false }
    expect(await (await call('/api/sync', json({ lists: [spiel] }))).json()).toEqual({ applied: 1, ignored: 0 })
    expect((await (await call('/api/sync')).json()).lists).toEqual([spiel])
    for (const bad of [{ ...spiel, kind: 'other' }, { ...spiel, id: 0 }, { ...spiel, title: '' }]) {
      expect((await call('/api/sync', json({ lists: [bad] }))).status).toBe(400)
    }
  })

  it('F008: syncs the BGG username and followed BGG users', async () => {
    const call = testApp(db)
    const setting = { bggUsername: 'mrmikkl', updatedAt: T1 }
    const follow = { bggUser: 'Anna_Meeple', updatedAt: T1, deleted: false }
    expect(await (await call('/api/sync', json({ settings: [setting], follows: [follow] }))).json()).toEqual({ applied: 2, ignored: 0 })
    const pulled = await (await call('/api/sync')).json()
    expect(pulled.settings).toEqual([{ ...setting, lengthLimits: null }])
    expect(pulled.follows).toEqual([{ ...follow, bggUser: 'anna_meeple' }])
    // last write wins: an older change is ignored, a newer one (a tombstone, a cleared name) wins
    expect(await (await call('/api/sync', json({ settings: [{ bggUsername: 'old', updatedAt: '2026-10-17T08:00:00.000Z' }] }))).json()).toEqual({
      applied: 0,
      ignored: 1,
    })
    const T2 = '2026-10-17T10:00:00.000Z'
    await call('/api/sync', json({ settings: [{ bggUsername: null, updatedAt: T2 }], follows: [{ ...follow, deleted: true, updatedAt: T2 }] }))
    const after = await (await call('/api/sync')).json()
    expect(after.settings).toEqual([{ bggUsername: null, lengthLimits: null, updatedAt: T2 }])
    expect(after.follows).toEqual([{ bggUser: 'anna_meeple', updatedAt: T2, deleted: true }])
  })

  it('F009: syncs the length limits; absent keeps them, null resets them', async () => {
    const call = testApp(db)
    const pull = async () => (await (await call('/api/sync')).json()).settings
    expect(await (await call('/api/sync', json({ settings: [{ bggUsername: 'mrmikkl', lengthLimits: [20, 45, 90], updatedAt: T1 }] }))).json()).toEqual({
      applied: 1,
      ignored: 0,
    })
    expect(await pull()).toEqual([{ bggUsername: 'mrmikkl', lengthLimits: [20, 45, 90], updatedAt: T1 }])
    // an older app sends the setting without lengthLimits: the limits stay
    await call('/api/sync', json({ settings: [{ bggUsername: 'anna', updatedAt: '2026-10-17T10:00:00.000Z' }] }))
    expect(await pull()).toEqual([{ bggUsername: 'anna', lengthLimits: [20, 45, 90], updatedAt: '2026-10-17T10:00:00.000Z' }])
    // an older change is ignored
    await call('/api/sync', json({ settings: [{ bggUsername: 'anna', lengthLimits: [10, 20, 30], updatedAt: T1 }] }))
    expect((await pull())[0].lengthLimits).toEqual([20, 45, 90])
    await call('/api/sync', json({ settings: [{ bggUsername: 'anna', lengthLimits: null, updatedAt: '2026-10-17T11:00:00.000Z' }] }))
    expect(await pull()).toEqual([{ bggUsername: 'anna', lengthLimits: null, updatedAt: '2026-10-17T11:00:00.000Z' }])
  })

  it.each([
    ['two limits', [30, 60]],
    ['four limits', [30, 60, 120, 240]],
    ['limits that do not increase', [60, 30, 120]],
    ['equal limits', [30, 30, 120]],
    ['a limit of 0', [0, 60, 120]],
    ['a limit above 600', [30, 60, 601]],
    ['a limit that is not whole', [30.5, 60, 120]],
    ['a limit as text', ['30', 60, 120]],
    ['limits that are not a list', 'short'],
  ])('F009: rejects %s with a clear 400', async (_, lengthLimits) => {
    const res = await testApp(db)('/api/sync', json({ settings: [{ bggUsername: null, lengthLimits, updatedAt: T1 }] }))
    expect(res.status).toBe(400)
    const answer = await res.json()
    expect(answer).toMatchObject({ error: 'bad_request', retryable: false })
    expect(answer.message).toMatch(/lengthLimits/)
  })

  it('F008: older apps that send no settings or follows keep working', async () => {
    const res = await testApp(db)('/api/sync', json({ collections: [collection], entries: [] }))
    expect(await res.json()).toEqual({ applied: 1, ignored: 0 })
  })

  it.each([
    ['a username that is empty', { settings: [{ bggUsername: '', updatedAt: T1 }] }, /username/i],
    ['a username over 50 characters', { settings: [{ bggUsername: 'x'.repeat(51), updatedAt: T1 }] }, /username/i],
    ['a username with odd characters', { settings: [{ bggUsername: 'anna<script>', updatedAt: T1 }] }, /username/i],
    ['a setting without updatedAt', { settings: [{ bggUsername: 'mrmikkl' }] }, /updatedAt/],
    ['a setting in the future', { settings: [{ bggUsername: 'mrmikkl', updatedAt: '2026-10-17T12:06:00.000Z' }] }, /future/],
    ['settings that are not a list', { settings: { bggUsername: 'mrmikkl', updatedAt: T1 } }, /settings/],
    ['a follow without a name', { follows: [{ bggUser: '', updatedAt: T1, deleted: false }] }, /BGG user/],
    ['a follow over 50 characters', { follows: [{ bggUser: 'x'.repeat(51), updatedAt: T1, deleted: false }] }, /BGG user/],
    ['a follow without deleted', { follows: [{ bggUser: 'anna', updatedAt: T1 }] }, /deleted/],
    ['a follow with a bad time', { follows: [{ bggUser: 'anna', updatedAt: 'soon', deleted: false }] }, /updatedAt/],
    ['follows that are not a list', { follows: 'anna' }, /follows/],
  ])('F008: rejects %s with a clear 400', async (_, body, message) => {
    const res = await testApp(db)('/api/sync', json(body))
    expect(res.status).toBe(400)
    const answer = await res.json()
    expect(answer).toMatchObject({ error: 'bad_request', retryable: false })
    expect(answer.message).toMatch(message)
  })

  it('F005: accepts and returns entries in For later', async () => {
    const call = testApp(db)
    const later = { ...entry, mark: 'later' as const }
    expect(await (await call('/api/sync', json({ collections: [collection], entries: [later] }))).json()).toEqual({ applied: 2, ignored: 0 })
    expect((await (await call('/api/sync')).json()).entries).toEqual([later])
  })

  it("rejects entries for another user's collection", async () => {
    await testApp(db)('/api/sync', json({ collections: [collection], entries: [] }))
    const res = await testApp(db, { email: 'ben@example.com' })('/api/sync', json({ collections: [], entries: [entry] }))
    expect(res.status).toBe(400)
  })

  it('returns the user and search availability on /api/me', async () => {
    expect(await (await testApp(db)('/api/me')).json()).toEqual({ email: 'anna@example.com', bggSearch: false })
  })

  it('sends a signed-in person from /api/signin back to the app', async () => {
    const res = await testApp(db)('/api/signin')
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
  })

  it('switches search on only once a BGG token is configured (Release 1.0, T066)', async () => {
    const me = await (await testApp(db, { env: { BGG_TOKEN: 'secret' } })('/api/me')).json()
    expect(me.bggSearch).toBe(true)
  })
})
