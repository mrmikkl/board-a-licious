import { describe, expect, it } from 'vitest'

import { CHUNK, hasFilterDetails, missingIds, readDetails } from '../../src/app/hooks/game-details-state.ts'
import { ApiError } from '../../src/client/api.ts'
import type { Game } from '../../src/client/types.ts'

const game = (bggId: number, extra: Partial<Game> = {}): Game => ({
  bggId,
  name: `Game ${bggId}`,
  year: 2020,
  thumbnailUrl: null,
  description: null,
  kind: 'boardgame',
  playingTime: 45,
  ...extra,
})
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i)

/** A fake API that answers every asked id (or fails as told) and records the calls. */
function fakeApi(answer: (ids: number[], call: number) => Game[] | Error = ids => ids.map(id => game(id))) {
  const asked: number[][] = []
  return {
    asked,
    api: {
      games: async (ids: number[]) => {
        asked.push(ids)
        const result = answer(ids, asked.length)
        if (result instanceof Error) throw result
        return result
      },
    },
  }
}
function fakeStore() {
  const put: Game[] = []
  return { put, store: { putGames: async (games: Game[]) => void put.push(...games) } }
}

describe('hasFilterDetails (research R2)', () => {
  it('needs a stored game with the key playingTime, also when it is null', () => {
    expect(hasFilterDetails(undefined)).toBe(false)
    const old = game(1)
    delete old.playingTime
    expect(hasFilterDetails(old)).toBe(false)
    expect(hasFilterDetails(game(1, { playingTime: null }))).toBe(true)
    expect(hasFilterDetails(game(1))).toBe(true)
  })
})

describe('missingIds', () => {
  it('lists ids not stored or stored without playingTime, once each, in list order', () => {
    const old = game(2)
    delete old.playingTime
    expect(missingIds([3, 1, 2, 3, 4], [game(1), old, game(4)])).toEqual([3, 2])
  })

  it('is empty when every game is stored', () => {
    expect(missingIds([1, 2], [game(1), game(2)])).toEqual([])
  })
})

describe('readDetails (US4, FR-009, FR-010)', () => {
  it('asks in chunks of 40, one after the other, stores answers and reports progress', async () => {
    const { api, asked } = fakeApi()
    const { store, put } = fakeStore()
    const progress: number[] = []
    const outcome = await readDetails({ ids: range(1, 90), api, store, onProgress: n => progress.push(n) })
    expect(CHUNK).toBe(40)
    expect(outcome).toEqual({ kind: 'done' })
    expect(asked.map(ids => ids.length)).toEqual([40, 40, 10])
    expect(asked[0]![0]).toBe(1)
    expect(asked[2]![9]).toBe(90)
    expect(put).toHaveLength(90)
    expect(progress).toEqual([40, 80, 90])
  })

  it('asks nothing when no id is missing', async () => {
    const { api, asked } = fakeApi()
    const { store } = fakeStore()
    expect(await readDetails({ ids: [], api, store, onProgress: () => {} })).toEqual({ kind: 'done' })
    expect(asked).toEqual([])
  })

  it('asks again for ids the Worker left out, and gives up on ids BGG does not answer', async () => {
    // first call answers only half; ids 1000+ never come back
    const { api, asked } = fakeApi((ids, call) => ids.filter(id => id < 1000 && (call > 1 || id % 2 === 0)).map(id => game(id)))
    const { store, put } = fakeStore()
    const outcome = await readDetails({ ids: [1, 2, 3, 4, 1000], api, store, onProgress: () => {} })
    expect(outcome).toEqual({ kind: 'done' })
    expect(asked).toEqual([
      [1, 2, 3, 4, 1000],
      [1, 3, 1000],
      [1000],
    ])
    expect(put.map(g => g.bggId).sort()).toEqual([1, 2, 3, 4])
  })

  it('stops offline and keeps what arrived; Try again resumes with the rest', async () => {
    const { api } = fakeApi((ids, call) => (call === 2 ? new ApiError('offline', 'No connection.', true) : ids.map(id => game(id))))
    const { store, put } = fakeStore()
    const progress: number[] = []
    expect(await readDetails({ ids: range(1, 100), api, store, onProgress: n => progress.push(n) })).toEqual({ kind: 'offline' })
    expect(put).toHaveLength(40)
    expect(progress).toEqual([40])

    const again = fakeApi()
    const rest = missingIds(range(1, 100), put)
    expect(rest).toHaveLength(60)
    expect(await readDetails({ ids: rest, api: again.api, store, onProgress: () => {} })).toEqual({ kind: 'done' })
    expect(again.asked.map(ids => ids.length)).toEqual([40, 20])
  })

  it('reports other failures as failed', async () => {
    const { api } = fakeApi(() => new ApiError('bgg_unavailable', 'BGG is busy.', true))
    const { store } = fakeStore()
    expect(await readDetails({ ids: [1], api, store, onProgress: () => {} })).toEqual({ kind: 'failed' })
  })

  it('stops between chunks once cancelled', async () => {
    let cancel = false
    const { api, asked } = fakeApi(ids => ((cancel = true), ids.map(id => game(id))))
    const { store } = fakeStore()
    expect(await readDetails({ ids: range(1, 90), api, store, onProgress: () => {}, cancelled: () => cancel })).toEqual({ kind: 'cancelled' })
    expect(asked).toHaveLength(1)
  })
})
