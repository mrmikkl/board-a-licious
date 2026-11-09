import { beforeEach, describe, expect, it } from 'vitest'

import type { Collection, Entry } from '../../src/domain/collection.ts'
import type { Db } from '../../worker/db/db.ts'
import { applyChanges, getCachedGames, listChanges, syncCursor, upsertGames } from '../../worker/db/repository.ts'
import { migrationSql, testDb } from './db-helpers.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const ANNA = 'anna@example.com'
const BEN = 'ben@example.com'

const collection = (patch: Partial<Collection> = {}): Collection => ({
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Essen 2026',
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
  facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', edition: 'English edition' },
  factsSource: 'preview',
  detailsPending: false,
  updatedAt: T1,
  deleted: false,
  ...patch,
})

let db: Db
const pause = () => new Promise(resolve => setTimeout(resolve, 20))
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

  it('returns only rows the server received after the cursor, including tombstones', async () => {
    await applyChanges(db, ANNA, { collections: [collection()], entries: [entry()] })
    await pause()
    const cursor = await syncCursor(db, 0)
    await pause()
    await applyChanges(db, ANNA, { collections: [], entries: [entry({ deleted: true, updatedAt: T2 })] })
    const changes = await listChanges(db, ANNA, cursor)
    expect(changes.collections).toEqual([])
    expect(changes.entries.map(e => e.deleted)).toEqual([true])
  })

  it('still delivers a change made earlier offline and sent after another device synced', async () => {
    await applyChanges(db, ANNA, { collections: [collection()], entries: [] })
    await pause()
    const laptopSyncedAt = await syncCursor(db, 0)
    await pause()
    // the phone made this change before the laptop's sync, but only sends it now
    await applyChanges(db, ANNA, { collections: [], entries: [entry({ updatedAt: T1 })] })
    expect((await listChanges(db, ANNA, laptopSyncedAt)).entries.map(e => e.bggId)).toEqual([446453])
  })

  it('gives a cursor a little in the past, so writes still on their way are not skipped', async () => {
    const [row] = await db.query<{ now: Date }>('SELECT now() AS now')
    expect(Date.parse(await syncCursor(db)) - new Date(row!.now).getTime()).toBeLessThanOrEqual(-4000)
  })

  it('limits every query to the caller', async () => {
    await applyChanges(db, ANNA, { collections: [collection()], entries: [entry()] })
    expect(await listChanges(db, BEN)).toEqual({ collections: [], entries: [], lists: [], settings: [], follows: [] })
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
    await bad(`INSERT INTO collection (id, user_email, name, updated_at) VALUES ($1, $2, '', now())`, [collection().id, ANNA])
    await db.query(`INSERT INTO collection (id, user_email, name, updated_at) VALUES ($1, $2, 'x', now())`, [
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

  it('keeps the BGG lists a person loaded, last write wins, per person', async () => {
    const spiel = { kind: 'preview' as const, id: 93, title: 'SPIEL Essen 2026', updatedAt: T1, deleted: false }
    expect(await applyChanges(db, ANNA, { collections: [], entries: [], lists: [spiel] })).toEqual({ applied: 1, ignored: 0 })
    expect((await listChanges(db, ANNA)).lists).toEqual([spiel])
    expect((await listChanges(db, BEN)).lists).toEqual([])
    expect(await applyChanges(db, ANNA, { collections: [], entries: [], lists: [{ ...spiel, title: 'old' }] })).toEqual({ applied: 0, ignored: 1 })
    await applyChanges(db, ANNA, { collections: [], entries: [], lists: [{ ...spiel, deleted: true, updatedAt: T2 }] })
    expect((await listChanges(db, ANNA)).lists).toEqual([{ ...spiel, deleted: true, updatedAt: T2 }])
    // Ben's copy of the same list is his own row
    await applyChanges(db, BEN, { collections: [], entries: [], lists: [spiel] })
    expect((await listChanges(db, BEN)).lists).toHaveLength(1)
  })

  it('F008: migration 0007 has user_setting and followed_bgg_user with their CHECKs and synced_at indexes', async () => {
    const bad = (sql: string, params: unknown[]) => expect(db.query(sql, params)).rejects.toThrow()
    const settingSql = `INSERT INTO user_setting (user_email, bgg_username, updated_at) VALUES ($1, $2, now())`
    await bad(settingSql, [ANNA, ''])
    await bad(settingSql, [ANNA, 'x'.repeat(51)])
    await db.query(settingSql, [ANNA, null])
    await bad(settingSql, [ANNA, 'mrmikkl']) // one row per person
    const followSql = `INSERT INTO followed_bgg_user (user_email, bgg_user, updated_at) VALUES ($1, $2, now())`
    await bad(followSql, [ANNA, ''])
    await bad(followSql, [ANNA, 'x'.repeat(51)])
    await db.query(followSql, [ANNA, 'anna_meeple'])
    await bad(followSql, [ANNA, 'anna_meeple'])
    const [row] = await db.query<{ deleted: boolean; synced_at: Date | null }>('SELECT deleted, synced_at FROM followed_bgg_user')
    expect(row).toMatchObject({ deleted: false })
    expect(row?.synced_at).not.toBeNull()
    const indexes = await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename IN ('user_setting', 'followed_bgg_user') AND indexdef LIKE '%synced_at%'`,
    )
    expect(indexes.map(i => i.indexdef.replace(/.* ON (?:public\.)?(\w+) .*\((.*)\)/, '$1($2)')).sort()).toEqual([
      'followed_bgg_user(user_email, synced_at)',
      'user_setting(user_email, synced_at)',
    ])
  })

  it('F008: keeps the BGG username per person, last write wins, null clears it', async () => {
    const empty = { collections: [], entries: [] }
    expect(await applyChanges(db, ANNA, { ...empty, settings: [{ bggUsername: 'mrmikkl', updatedAt: T1 }] })).toEqual({ applied: 1, ignored: 0 })
    expect((await listChanges(db, ANNA)).settings).toEqual([{ bggUsername: 'mrmikkl', lengthLimits: null, updatedAt: T1 }])
    expect((await listChanges(db, BEN)).settings).toEqual([])
    expect(await applyChanges(db, ANNA, { ...empty, settings: [{ bggUsername: 'old', updatedAt: T1 }] })).toEqual({ applied: 0, ignored: 1 })
    await applyChanges(db, ANNA, { ...empty, settings: [{ bggUsername: null, updatedAt: T2 }] })
    expect((await listChanges(db, ANNA)).settings).toEqual([{ bggUsername: null, lengthLimits: null, updatedAt: T2 }])
  })

  it('F008: keeps followed BGG users lower-cased, with tombstones and the synced_at cursor', async () => {
    const empty = { collections: [], entries: [] }
    const anna = { bggUser: 'Anna_Meeple', updatedAt: T1, deleted: false }
    expect(await applyChanges(db, ANNA, { ...empty, follows: [anna] })).toEqual({ applied: 1, ignored: 0 })
    expect((await listChanges(db, ANNA)).follows).toEqual([{ ...anna, bggUser: 'anna_meeple' }])
    expect((await listChanges(db, BEN)).follows).toEqual([])
    expect(await applyChanges(db, ANNA, { ...empty, follows: [{ ...anna, deleted: true }] })).toEqual({ applied: 0, ignored: 1 })
    await pause()
    const cursor = await syncCursor(db, 0)
    await pause()
    expect((await listChanges(db, ANNA, cursor)).follows).toEqual([])
    await applyChanges(db, ANNA, { ...empty, follows: [{ bggUser: 'anna_meeple', updatedAt: T2, deleted: true }] })
    expect((await listChanges(db, ANNA, cursor)).follows).toEqual([{ bggUser: 'anna_meeple', updatedAt: T2, deleted: true }])
  })

  it('caches games and returns only fresh ones', async () => {
    const game = { bggId: 295947, name: 'Cascadia', year: 2021, thumbnailUrl: null, description: 'Tiles.', kind: 'boardgame' as const, playingTime: 45, minPlayers: 1, maxPlayers: 4, designers: ['Randy Flynn'], mechanisms: ["Tile Placement", 'Drafting'], publisher: 'Flatout Games', rating: null, geekRating: null, bestWith: '2–3 players', recommendedWith: '1–4 players', playerPoll: [{ players: '2', best: 587, recommended: 334, notRecommended: 17 }], playerPollVoters: 1043 }
    await upsertGames(db, [game], '2026-10-01T00:00:00.000Z')
    expect(await getCachedGames(db, [295947], '2026-09-30T00:00:00.000Z')).toEqual([game])
    expect(await getCachedGames(db, [295947], '2026-10-02T00:00:00.000Z')).toEqual([])
  })

  it('F009: stores the playing time with the game; none is null', async () => {
    const base = { bggId: 1, name: 'Mini', year: null, thumbnailUrl: null, description: null, kind: 'boardgame' as const, minPlayers: null, maxPlayers: null, designers: [], mechanisms: [], publisher: null }
    await upsertGames(db, [{ ...base, playingTime: 90 }, { ...base, bggId: 2, playingTime: null }, { ...base, bggId: 3 }], '2026-10-01T00:00:00.000Z')
    const games = await getCachedGames(db, [1, 2, 3], '2026-09-30T00:00:00.000Z')
    expect(games.map(g => [g.bggId, g.playingTime])).toEqual([[1, 90], [2, null], [3, null]])
  })

  it('F009: keeps the length limits with the BGG username, last write wins; absent keeps, null resets', async () => {
    const empty = { collections: [], entries: [] }
    await applyChanges(db, ANNA, { ...empty, settings: [{ bggUsername: 'mrmikkl', lengthLimits: [20, 45, 90], updatedAt: T1 }] })
    expect((await listChanges(db, ANNA)).settings).toEqual([{ bggUsername: 'mrmikkl', lengthLimits: [20, 45, 90], updatedAt: T1 }])
    await applyChanges(db, ANNA, { ...empty, settings: [{ bggUsername: 'anna', updatedAt: T2 }] })
    expect((await listChanges(db, ANNA)).settings).toEqual([{ bggUsername: 'anna', lengthLimits: [20, 45, 90], updatedAt: T2 }])
    await applyChanges(db, ANNA, { ...empty, settings: [{ bggUsername: 'anna', lengthLimits: null, updatedAt: '2026-10-17T11:00:00.000Z' }] })
    expect((await listChanges(db, ANNA)).settings).toEqual([{ bggUsername: 'anna', lengthLimits: null, updatedAt: '2026-10-17T11:00:00.000Z' }])
  })

  it('F009: 0008 adds the playing time and marks games stored before it stale, once', async () => {
    const old = await testDb({ before: '0008' })
    await old.query(`INSERT INTO game (bgg_id, name, kind, fetched_at) VALUES (1, 'Old', 'boardgame', '2026-11-08T00:00:00Z')`)
    await old.exec(migrationSql('0008_list_filter.sql'))
    const fetched = async () => (await old.query<{ fetched_at: Date }>('SELECT fetched_at FROM game WHERE bgg_id = 1'))[0]!.fetched_at.toISOString()
    expect(await fetched()).toBe('1970-01-01T00:00:00.000Z')
    // the files run again on every migrate: games read since then stay fresh
    await old.query(`UPDATE game SET fetched_at = '2026-11-10T00:00:00Z', playing_time = 45`)
    await old.exec(migrationSql('0008_list_filter.sql'))
    expect(await fetched()).toBe('2026-11-10T00:00:00.000Z')
    await old.query(`INSERT INTO user_setting (user_email, length_limits, updated_at) VALUES ($1, $2::jsonb, now())`, [ANNA, '[30, 60, 120]'])
  })

  it('F009: the Worker adds the playing time itself before the migration ran, marking old games stale', async () => {
    const old = await testDb({ before: '0008' })
    await old.query(`INSERT INTO game (bgg_id, name, kind, fetched_at) VALUES (1, 'Old', 'boardgame', '2026-11-08T00:00:00Z')`)
    expect(await getCachedGames(old, [1], '2026-11-01T00:00:00.000Z')).toEqual([])
    await old.exec(migrationSql('0008_list_filter.sql'))
    const [row] = await old.query<{ fetched_at: Date }>('SELECT fetched_at FROM game WHERE bgg_id = 1')
    expect(row!.fetched_at.toISOString()).toBe('1970-01-01T00:00:00.000Z')
  })
})
