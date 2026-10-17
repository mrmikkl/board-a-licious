import { beforeEach, describe, expect, it } from 'vitest'

import type { Collection, Entry } from '../../src/domain/collection.ts'
import type { Db } from '../../worker/db/db.ts'
import { applyChanges, getCachedGames, listChanges, upsertGames } from '../../worker/db/repository.ts'
import { testDb } from './db-helpers.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const ANNA = 'anna@example.com'
const BEN = 'ben@example.com'

const collection = (patch: Partial<Collection> = {}): Collection => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Essen 2026',
  type: 'essen',
  updatedAt: T1,
  deleted: false,
  ...patch,
})
const entry = (patch: Partial<Entry> = {}): Entry => ({
  collectionId: collection().id,
  bggId: 446453,
  mark: 'must_have',
  bought: true,
  paidCents: 5200,
  paidCurrency: 'EUR',
  facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games' },
  factsSource: 'preview',
  detailsPending: false,
  updatedAt: T1,
  deleted: false,
  ...patch,
})

let db: Db
beforeEach(async () => {
  db = await testDb()
})

describe('repository', () => {
  it('stores and returns collections and entries with all fields', async () => {
    expect(await applyChanges(db, ANNA, { collections: [collection()], entries: [entry()] })).toEqual({
      applied: 2,
      ignored: 0,
    })
    const changes = await listChanges(db, ANNA)
    expect(changes.collections).toEqual([collection()])
    expect(changes.entries).toEqual([entry()])
  })

  it('applies last-write-wins: later wins, equal or older is ignored', async () => {
    await applyChanges(db, ANNA, { collections: [collection()], entries: [entry()] })
    const older = await applyChanges(db, ANNA, { collections: [], entries: [entry({ mark: 'poop', updatedAt: T1 })] })
    expect(older).toEqual({ applied: 0, ignored: 1 })
    const newer = await applyChanges(db, ANNA, { collections: [], entries: [entry({ mark: 'poop', updatedAt: T2 })] })
    expect(newer).toEqual({ applied: 1, ignored: 0 })
    expect((await listChanges(db, ANNA)).entries[0]?.mark).toBe('poop')
  })

  it('returns only rows changed after since, including tombstones', async () => {
    await applyChanges(db, ANNA, { collections: [collection()], entries: [entry()] })
    await applyChanges(db, ANNA, { collections: [], entries: [entry({ deleted: true, updatedAt: T2 })] })
    const changes = await listChanges(db, ANNA, '2026-10-17T09:30:00.000Z')
    expect(changes.collections).toEqual([])
    expect(changes.entries.map(e => e.deleted)).toEqual([true])
  })

  it('limits every query to the caller', async () => {
    await applyChanges(db, ANNA, { collections: [collection()], entries: [entry()] })
    expect(await listChanges(db, BEN)).toEqual({ collections: [], entries: [] })
    // Ben cannot overwrite Anna's collection or add entries to it
    const attempt = await applyChanges(db, BEN, { collections: [collection({ name: 'Mine', updatedAt: T2 })], entries: [] })
    expect(attempt).toEqual({ applied: 0, ignored: 1 })
    await expect(applyChanges(db, BEN, { collections: [], entries: [entry({ updatedAt: T2 })] })).rejects.toThrow(
      /collection/i,
    )
    expect((await listChanges(db, ANNA)).collections[0]?.name).toBe('Essen 2026')
  })

  it('enforces the CHECKs of the schema', async () => {
    const bad = (sql: string, params: unknown[]) => expect(db.query(sql, params)).rejects.toThrow()
    await bad(`INSERT INTO collection (id, user_email, name, type, updated_at) VALUES ($1, $2, '', 'essen', now())`, [
      collection().id,
      ANNA,
    ])
    await bad(`INSERT INTO collection (id, user_email, name, type, updated_at) VALUES ($1, $2, 'x', 'other', now())`, [
      collection().id,
      ANNA,
    ])
    await db.query(`INSERT INTO collection (id, user_email, name, type, updated_at) VALUES ($1, $2, 'x', 'essen', now())`, [
      collection().id,
      ANNA,
    ])
    const entrySql = `INSERT INTO collection_entry (collection_id, bgg_id, user_email, paid_cents, paid_currency, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())`
    await bad(entrySql, [collection().id, 0, ANNA, null, null])
    await bad(entrySql, [collection().id, 1, ANNA, -1, 'EUR'])
    await bad(entrySql, [collection().id, 1, ANNA, 100, 'euro'])
    await bad(entrySql, [collection().id, 1, ANNA, null, 'EUR'])
  })

  it('caches games and returns only fresh ones', async () => {
    const game = { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: null, description: 'Tiles.', kind: 'boardgame' as const }
    await upsertGames(db, [game], '2026-10-01T00:00:00.000Z')
    expect(await getCachedGames(db, [295947], '2026-09-30T00:00:00.000Z')).toEqual([game])
    expect(await getCachedGames(db, [295947], '2026-10-02T00:00:00.000Z')).toEqual([])
  })
})
