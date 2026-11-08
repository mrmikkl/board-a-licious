import { describe, expect, it, vi } from 'vitest'

import { withSavedStatus } from '../../src/app/hooks/bgg-collection-state.ts'
import { ApiError, createApi } from '../../src/client/api.ts'
import type { StoredBggCollection } from '../../src/client/types.ts'
import { NO_STATUS } from '../../src/domain/bgg-status.ts'

/** F008 US3–US5: the client side of `/api/bgg/account*` (contracts/api.md). */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  })
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls }
}

describe('account, signIn, signOut', () => {
  it('reads the sign-in state', async () => {
    const { fetch, calls } = fakeFetch(200, { signedIn: true, bggUser: 'mrmikkl' })
    expect(await createApi({ fetch }).account()).toEqual({ signedIn: true, bggUser: 'mrmikkl' })
    expect(calls[0]!.url).toBe('/api/bgg/account')
  })

  it('posts the credentials once and returns who is signed in', async () => {
    const { fetch, calls } = fakeFetch(200, { signedIn: true, bggUser: 'mrmikkl' })
    expect(await createApi({ fetch }).signIn('mrmikkl', 'secret')).toEqual({ signedIn: true, bggUser: 'mrmikkl' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('/api/bgg/account/signin')
    expect(calls[0]!.init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ username: 'mrmikkl', password: 'secret' })
  })

  it('a refused sign-in is bgg_signed_out, not an expired app sign-in', async () => {
    const onUnauthenticated = vi.fn()
    const { fetch } = fakeFetch(401, { error: 'bgg_signed_out', message: 'BoardGameGeek did not accept this username or password.', retryable: false })
    const error = await createApi({ fetch, onUnauthenticated }).signIn('mrmikkl', 'wrong').catch(e => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('bgg_signed_out')
    expect(error.message).toBe('BoardGameGeek did not accept this username or password.')
    expect(error.message).not.toContain('wrong')
    expect(onUnauthenticated).not.toHaveBeenCalled()
  })

  it('signs out', async () => {
    const { fetch, calls } = fakeFetch(200, { signedIn: false })
    await createApi({ fetch }).signOut()
    expect(calls[0]!.url).toBe('/api/bgg/account/signout')
    expect(calls[0]!.init?.method).toBe('POST')
  })
})

describe('saveStatus', () => {
  it('posts the body to the game and returns its statuses', async () => {
    const status = { ...NO_STATUS, own: true }
    const { fetch, calls } = fakeFetch(200, { bggId: 7, status })
    expect(await createApi({ fetch }).saveStatus(7, { status: { own: true } })).toEqual({ kind: 'saved', status })
    expect(calls[0]!.url).toBe('/api/bgg/account/collection/7')
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ status: { own: true } })
  })

  it('a price conflict returns the price BGG has', async () => {
    const { fetch } = fakeFetch(409, { error: 'price_conflict', message: 'BGG has a price.', retryable: false, current: { amount: 39.99, currency: 'EUR' } })
    expect(await createApi({ fetch }).saveStatus(7, { privateInfo: { acquisitionDate: '2026-11-08' } })).toEqual({
      kind: 'conflict',
      current: { amount: 39.99, currency: 'EUR' },
    })
  })

  it('a refused save is bgg_refused', async () => {
    const { fetch } = fakeFetch(502, { error: 'bgg_refused', message: 'BoardGameGeek did not take the change.', retryable: true })
    await expect(createApi({ fetch }).saveStatus(7, { status: { own: true } })).rejects.toMatchObject({ code: 'bgg_refused' })
  })
})

describe('withSavedStatus', () => {
  const owned = { ...NO_STATUS, own: true }
  const game = { bggId: 7, name: 'Harbour Lights', year: 2024, thumbnailUrl: null, kind: 'boardgame' as const }
  const stored: StoredBggCollection = {
    bggUser: 'mrmikkl',
    items: [{ ...game, status: NO_STATUS }, { ...game, bggId: 8, name: 'Owl Post', status: owned }],
    loadedAt: '2026-11-08T18:00:00.000Z',
    error: null,
  }

  it("replaces the game's status and keeps the rest and the load time", () => {
    const next = withSavedStatus('mrmikkl', stored, game, owned)
    expect(next.items.map(i => [i.bggId, i.status.own])).toEqual([[7, true], [8, true]])
    expect(next.loadedAt).toBe(stored.loadedAt)
  })

  it('adds a game that was not in the collection', () => {
    const next = withSavedStatus('mrmikkl', stored, { ...game, bggId: 9, name: 'Salt Roads' }, owned)
    expect(next.items.map(i => i.bggId)).toEqual([7, 8, 9])
  })

  it('starts a collection when none was read yet (loaded later)', () => {
    expect(withSavedStatus('MrMikkl', undefined, game, owned)).toEqual({ bggUser: 'mrmikkl', items: [{ ...game, status: owned }], loadedAt: null, error: null })
  })
})
