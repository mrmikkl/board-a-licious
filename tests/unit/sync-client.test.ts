import { afterEach, describe, expect, it } from 'vitest'

import { ApiError, createApi } from '../../src/client/api.ts'
import { type Store, deleteStore, openStore } from '../../src/client/store.ts'
import { createSync } from '../../src/client/sync.ts'
import { newEntry } from '../../src/domain/collection.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>
function fakeServer(handler: Handler) {
  const calls: { method: string; url: URL; body?: unknown }[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://app.example')
    calls.push({ method: init?.method ?? 'GET', url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    return handler(url, init)
  }
  return { calls, fetch }
}

let store: Store | undefined
afterEach(async () => {
  if (!store) return
  store.close()
  await deleteStore(store.email)
  store = undefined
})
const track = (s: Store) => void (store = s)

describe('api', () => {
  it('maps error bodies to ApiError and network failures to offline', async () => {
    const down = createApi({ fetch: async () => Response.json({ error: 'bgg_unavailable', message: 'x', retryable: true }, { status: 502 }) })
    await expect(down.games([1])).rejects.toMatchObject({ code: 'bgg_unavailable', retryable: true })
    const offline = createApi({ fetch: () => Promise.reject(new TypeError('Failed to fetch')) })
    const error = await offline.me().catch(e => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'offline', retryable: true })
  })
})

describe('expired sign-in (Cloudflare Access)', () => {
  it('treats the Access login redirect and 401 as unauthenticated and reports it', async () => {
    const seen: string[] = []
    const redirect = { ok: false, status: 0, type: 'opaqueredirect', json: async () => ({}) } as unknown as Response
    const viaAccess = createApi({ fetch: async () => redirect, onUnauthenticated: () => seen.push('redirect') })
    await expect(viaAccess.me()).rejects.toMatchObject({ code: 'unauthenticated', retryable: false })
    const via401 = createApi({
      fetch: async () => Response.json({ error: 'unauthenticated', message: 'Sign in', retryable: false }, { status: 401 }),
      onUnauthenticated: () => seen.push('401'),
    })
    await expect(via401.pull()).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(seen).toEqual(['redirect', '401'])
  })

  it('asks fetch not to follow redirects, so a login page is never mistaken for data', async () => {
    let init: RequestInit | undefined
    await createApi({ fetch: async (_, i) => ((init = i), Response.json({ email: 'a@b.c', bggSearch: false })) }).me()
    expect(init?.redirect).toBe('manual')
  })
})

describe('sync', () => {
  it('pushes the outbox, acknowledges it, then pulls since the last sync', async () => {
    const store = await openStore('anna@example.com')
    track(store)
    await store.saveEntry({ ...newEntry('c1', 1, T1), mark: 'must_have' })
    const server = fakeServer((url, init) =>
      init?.method === 'POST'
        ? Response.json({ applied: 1, ignored: 0 })
        : Response.json({ collections: [], entries: [newEntry('c1', 2, T2)], serverTime: T2 }),
    )
    const sync = createSync({ store, api: createApi({ fetch: server.fetch }) })

    await sync.syncNow()
    expect(server.calls.map(c => c.method)).toEqual(['POST', 'GET'])
    expect(server.calls[0]?.body).toMatchObject({ collections: [], entries: [{ bggId: 1, mark: 'must_have' }] })
    expect(await store.pending()).toEqual([])
    expect((await store.entries('c1')).map(e => e.bggId)).toEqual([1, 2])
    expect(await store.meta('lastSyncAt')).toBe(T2)

    await sync.syncNow()
    expect(server.calls[2]?.url.searchParams.get('since')).toBe(T2)
  })

  it('merges pulled rows last-write-wins', async () => {
    const store = await openStore('anna@example.com')
    track(store)
    await store.applyRemote({ collections: [], entries: [{ ...newEntry('c1', 1, T2), mark: 'must_have' }] })
    const server = fakeServer(() =>
      Response.json({ collections: [], entries: [{ ...newEntry('c1', 1, T1), mark: 'poop' }], serverTime: T2 }),
    )
    await createSync({ store, api: createApi({ fetch: server.fetch }) }).syncNow()
    expect((await store.entries('c1'))[0]?.mark).toBe('must_have')
  })

  it('keeps the outbox after a network error and retries when back online', async () => {
    const store = await openStore('anna@example.com')
    track(store)
    await store.saveEntry(newEntry('c1', 1, T1))
    let online = false
    const server = fakeServer((_, init) => {
      if (!online) throw new TypeError('Failed to fetch')
      return init?.method === 'POST'
        ? Response.json({ applied: 1, ignored: 0 })
        : Response.json({ collections: [], entries: [], serverTime: T2 })
    })
    const events = new EventTarget()
    const sync = createSync({ store, api: createApi({ fetch: server.fetch }), events })

    await expect(sync.syncNow()).rejects.toMatchObject({ code: 'offline' })
    expect(await store.pending()).toHaveLength(1)

    online = true
    const stop = sync.start()
    events.dispatchEvent(new Event('online'))
    await sync.idle()
    stop()
    expect(await store.pending()).toEqual([])
  })

  it('pushes loaded lists and shows lists loaded on other devices, ready to load here', async () => {
    store = await openStore('anna@example.com')
    await store.saveListRef({ kind: 'geeklist', id: 66420, title: 'Top games', isEssen: false, updatedAt: T1, deleted: false })
    const spiel = { kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, updatedAt: T2, deleted: false }
    const server = fakeServer((_, init) =>
      init?.method === 'POST'
        ? Response.json({ applied: 1, ignored: 0 })
        : Response.json({ collections: [], entries: [], lists: [spiel], serverTime: T2 }),
    )
    await createSync({ store, api: createApi({ fetch: server.fetch }) }).syncNow()
    expect(server.calls[0]?.body).toMatchObject({ lists: [{ kind: 'geeklist', id: 66420 }] })
    const here = await store.list('preview', 93)
    expect(here).toMatchObject({ kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, loadedPages: 0, pageCount: 0, entries: [] })
    expect(here?.items).toBeUndefined()
  })

  it('pushes in chunks of at most 500 items', async () => {
    const store = await openStore('anna@example.com')
    track(store)
    for (let i = 1; i <= 501; i++) await store.saveEntry(newEntry('c1', i, T1))
    const server = fakeServer((_, init) =>
      init?.method === 'POST'
        ? Response.json({ applied: 1, ignored: 0 })
        : Response.json({ collections: [], entries: [], serverTime: T2 }),
    )
    await createSync({ store, api: createApi({ fetch: server.fetch }) }).syncNow()
    const posts = server.calls.filter(c => c.method === 'POST') as { body: { entries: unknown[] } }[]
    expect(posts.map(p => p.body.entries.length)).toEqual([500, 1])
  })
})
