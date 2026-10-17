import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { type Api, ApiError } from '../../src/client/api.ts'
import { createListLoader } from '../../src/client/lists.ts'
import { type Store, deleteStore, openStore } from '../../src/client/store.ts'
import type { ListKind, StoredList, StoredListEntry } from '../../src/client/types.ts'
import { type Entry, newEntry } from '../../src/domain/collection.ts'

const START = Date.parse('2026-10-17T12:00:00.000Z')
const HOUR = 3600_000

/** A clock that only moves when the loader sleeps. */
function fakeClock() {
  const clock = {
    t: START,
    sleeps: [] as number[],
    now: () => clock.t,
    sleep: async (ms: number) => {
      clock.sleeps.push(ms)
      clock.t += ms
    },
  }
  return clock
}

const row = (page: number, i: number, publisher: string | null = 'Inside Up Games'): StoredListEntry => ({
  position: (page - 1) * 10 + i + 1,
  bggId: page * 100 + i,
  name: `Game ${page}-${i}`,
  thumbnailUrl: null,
  facts: { booth: `3-R${page}0${i}`, priceCents: 1000 * page, currency: 'EUR', publisherId: 34183, publisher },
})

/** BGG through the Worker: `pageCount` pages of two games each; hooks run while a page is requested. */
function fakeApi(clock: ReturnType<typeof fakeClock>, options: { pageCount?: number; publisher?: string | null } = {}) {
  const pageCount = options.pageCount ?? 3
  const fake = {
    calls: [] as { what: string; at: number }[],
    failing: new Set<number>(),
    onPage: {} as Record<number, () => void>,
    booth: (page: number, i: number) => row(page, i).facts!.booth,
    api: {
      async listPage(kind: ListKind, id: number, page: number) {
        fake.calls.push({ what: `page ${page}`, at: clock.now() })
        fake.onPage[page]?.()
        if (fake.failing.has(page)) throw new ApiError('bgg_unavailable', 'BoardGameGeek answered 500.', true)
        const entries = [0, 1].map(i => ({ ...row(page, i, options.publisher), facts: { ...row(page, i, options.publisher).facts!, booth: fake.booth(page, i) } }))
        return { kind, id, title: 'SPIEL Essen 2026', isEssen: kind === 'preview', page, pageCount, entries }
      },
      async companies(ids: number[]) {
        fake.calls.push({ what: `companies ${ids.join(',')}`, at: clock.now() })
        return ids.map(id => ({ id, name: `Company ${id}` }))
      },
    } as unknown as Api,
  }
  return fake
}

let store: Store
let clock: ReturnType<typeof fakeClock>
let events: EventTarget
let foreground: boolean
beforeEach(async () => {
  store = await openStore('anna@example.com')
  clock = fakeClock()
  events = new EventTarget()
  foreground = true
})
afterEach(async () => {
  store.close()
  await deleteStore('anna@example.com')
})

const loaderFor = (api: Api) =>
  createListLoader({ store, api, now: clock.now, sleep: clock.sleep, foreground: () => foreground, events })

describe('list loader', () => {
  it('stores page 1 at once and returns it before the rest is loaded', async () => {
    const bgg = fakeApi(clock)
    const loader = loaderFor(bgg.api)
    const list = await loader.open('preview', 93)
    expect(bgg.calls[0]).toEqual({ what: 'page 1', at: START })
    expect(list).toMatchObject({ kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, pageCount: 3, loadedPages: 1 })
    expect(list.entries.map(e => e.bggId)).toEqual([100, 101])
    expect(list.openedAt).toBe(new Date(START).toISOString())
    await loader.idle()
  })

  it('loads the remaining pages one by one, at most one request per second, storing progress', async () => {
    const bgg = fakeApi(clock)
    const loader = loaderFor(bgg.api)
    const progress: number[] = []
    const reads: Promise<unknown>[] = []
    const stop = store.subscribe(() => void reads.push(store.list('preview', 93).then(l => l && progress.push(l.loadedPages))))
    await loader.open('preview', 93)
    await loader.idle()
    stop()
    await Promise.all(reads)
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2', 'page 3'])
    const gaps = bgg.calls.slice(1).map((c, i) => c.at - bgg.calls[i]!.at)
    expect(gaps.every(gap => gap >= 1000)).toBe(true)
    const stored = (await store.list('preview', 93)) as StoredList
    expect(stored).toMatchObject({ loadedPages: 3, pageCount: 3, loadedAt: expect.any(String) })
    expect(stored.error).toBeUndefined()
    expect(stored.entries.map(e => e.position)).toEqual([1, 2, 11, 12, 21, 22])
    expect(progress).toContain(2)
  })

  it('shows a game listed on two pages (two editions) once, with both booths, and loses neither', async () => {
    const bgg = fakeApi(clock)
    const second = bgg.api.listPage.bind(bgg.api)
    bgg.api.listPage = (async (kind: ListKind, id: number, page: number) => {
      const result = await second(kind, id, page)
      // page 3's first game is another edition of page 1's first game, at another booth
      if (page === 3) result.entries[0] = { ...result.entries[0]!, bggId: 100, facts: { ...result.entries[0]!.facts!, booth: '9-Z999' } }
      return result
    }) as Api['listPage']
    const loader = loaderFor(bgg.api)
    await loader.open('preview', 93)
    await loader.idle()
    const stored = (await store.list('preview', 93)) as StoredList
    expect(stored.entries.map(e => e.bggId)).toEqual([100, 101, 200, 201, 301])
    expect(stored.entries[0]?.facts?.booth).toBe(`${bgg.booth(1, 0)} / 9-Z999`)
  })

  it('remembers a newly loaded list for the other devices (outbox)', async () => {
    const loader = loaderFor(fakeApi(clock).api)
    await loader.open('preview', 93)
    await loader.idle()
    const refs = (await store.pending()).filter(p => p.kind === 'list')
    expect(refs.map(p => p.row)).toEqual([
      { kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, updatedAt: new Date(START).toISOString(), deleted: false },
    ])
    await loader.open('preview', 93)
    expect((await store.pending()).filter(p => p.kind === 'list')).toHaveLength(1)
  })

  it('loads a list that arrived from another device (0 pages yet) when it is opened', async () => {
    await store.applyRemote({ collections: [], entries: [], lists: [{ kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, updatedAt: new Date(START).toISOString(), deleted: false }] })
    const bgg = fakeApi(clock)
    const loader = loaderFor(bgg.api)
    const list = await loader.open('preview', 93)
    expect(list.pageCount).toBe(3)
    await loader.idle()
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2', 'page 3'])
    expect((await store.list('preview', 93))?.entries).toHaveLength(6)
  })

  it('queues lists loaded before lists were synced, so they reach the other devices', async () => {
    await store.putList({ kind: 'preview', id: 93, title: 'SPIEL Essen 2026', isEssen: true, pageCount: 3, loadedPages: 3, entries: [], openedAt: new Date(START).toISOString() })
    await loaderFor(fakeApi(clock).api).open('preview', 93)
    expect((await store.pending()).filter(p => p.kind === 'list').map(p => p.row)).toMatchObject([{ kind: 'preview', id: 93 }])
  })

  it('resumes after a reload where it stopped', async () => {
    const first = fakeApi(clock)
    const before = loaderFor(first.api)
    first.onPage[2] = () => before.close('preview', 93)
    await before.open('preview', 93)
    await before.idle()
    expect((await store.list('preview', 93))?.loadedPages).toBe(2)

    const second = fakeApi(clock)
    const loader = loaderFor(second.api)
    const list = await loader.open('preview', 93)
    expect(list.loadedPages).toBe(2)
    await loader.idle()
    expect(second.calls.map(c => c.what)).toEqual(['page 3'])
    expect((await store.list('preview', 93))?.entries).toHaveLength(6)
  })

  it('pauses while the list is closed and goes on when it is opened again', async () => {
    const bgg = fakeApi(clock)
    const loader = loaderFor(bgg.api)
    bgg.onPage[2] = () => loader.close('preview', 93)
    await loader.open('preview', 93)
    await loader.idle()
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2'])
    await loader.open('preview', 93)
    await loader.idle()
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2', 'page 3'])
  })

  it('keeps loading while another screen still has the list open', async () => {
    const bgg = fakeApi(clock)
    const loader = loaderFor(bgg.api)
    await loader.open('preview', 93)
    bgg.onPage[2] = () => loader.close('preview', 93)
    await loader.open('preview', 93)
    await loader.idle()
    expect((await store.list('preview', 93))?.loadedPages).toBe(3)
  })

  it('pauses while the app is in the background and goes on in the foreground', async () => {
    const bgg = fakeApi(clock)
    const loader = loaderFor(bgg.api)
    bgg.onPage[2] = () => {
      foreground = false
      events.dispatchEvent(new Event('visibilitychange'))
    }
    await loader.open('preview', 93)
    await loader.idle()
    expect((await store.list('preview', 93))?.loadedPages).toBe(2)
    foreground = true
    events.dispatchEvent(new Event('visibilitychange'))
    await loader.idle()
    expect((await store.list('preview', 93))?.loadedPages).toBe(3)
  })

  it('stops with a retryable error when a page fails, and retries on demand', async () => {
    const bgg = fakeApi(clock)
    bgg.failing.add(2)
    const loader = loaderFor(bgg.api)
    await loader.open('preview', 93)
    await loader.idle()
    expect(await store.list('preview', 93)).toMatchObject({ loadedPages: 1, error: 'BoardGameGeek is not reachable.' })
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2'])

    bgg.failing.clear()
    loader.retry('preview', 93)
    await loader.idle()
    const stored = await store.list('preview', 93)
    expect(stored?.loadedPages).toBe(3)
    expect(stored?.error).toBeUndefined()
  })

  it('rejects when the first page of a new list fails', async () => {
    const bgg = fakeApi(clock)
    bgg.failing.add(1)
    await expect(loaderFor(bgg.api).open('preview', 93)).rejects.toMatchObject({ code: 'bgg_unavailable' })
    expect(await store.list('preview', 93)).toBeUndefined()
  })

  it('resolves missing publishers afterwards and keeps them on the device', async () => {
    const bgg = fakeApi(clock, { pageCount: 2, publisher: null })
    const loader = loaderFor(bgg.api)
    await loader.open('preview', 93)
    await loader.idle()
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2', 'companies 34183'])
    expect(bgg.calls[2]!.at - bgg.calls[1]!.at).toBeGreaterThanOrEqual(1000)
    const stored = await store.list('preview', 93)
    expect(stored?.entries.map(e => e.facts?.publisher)).toEqual(Array(4).fill('Company 34183'))
    expect(await store.publishers([34183])).toEqual({ 34183: 'Company 34183' })
  })

  it('fills publishers known on the device without asking again', async () => {
    await store.putPublishers({ 34183: 'Inside Up Games' })
    const bgg = fakeApi(clock, { pageCount: 1, publisher: null })
    const loader = loaderFor(bgg.api)
    const list = await loader.open('preview', 93)
    await loader.idle()
    expect(list.entries[0]?.facts?.publisher).toBe('Inside Up Games')
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1'])
  })

  it('does not load again within an hour', async () => {
    const bgg = fakeApi(clock, { pageCount: 1 })
    const loader = loaderFor(bgg.api)
    await loader.open('preview', 93)
    await loader.idle()
    clock.t += HOUR / 2
    await loader.open('preview', 93)
    await loader.idle()
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1'])
  })

  it('reloads after an hour and refreshes preview facts in collections, never manual ones', async () => {
    const bgg = fakeApi(clock, { pageCount: 2 })
    const loader = loaderFor(bgg.api)
    await loader.open('preview', 93)
    await loader.idle()

    const T = new Date(START).toISOString()
    const fromPreview: Entry = { ...newEntry('essen', 100, T), facts: { booth: '3-R100', priceCents: 1000, currency: 'EUR', publisher: 'Inside Up Games' }, factsSource: 'preview' }
    const typed: Entry = { ...newEntry('essen', 201, T), facts: { booth: 'my booth', priceCents: 1, currency: 'EUR', publisher: null }, factsSource: 'manual' }
    await store.saveEntries([fromPreview, typed])

    clock.t += 2 * HOUR
    bgg.booth = (page, i) => `5-X${page}${i}`
    const list = await loader.open('preview', 93)
    expect(list.entries).toHaveLength(4)
    await loader.idle()
    expect(bgg.calls.map(c => c.what)).toEqual(['page 1', 'page 2', 'page 1', 'page 2'])
    const stored = await store.list('preview', 93)
    expect(stored?.entries.map(e => e.facts?.booth)).toEqual(['5-X10', '5-X11', '5-X20', '5-X21'])
    const entries = await store.entries('essen')
    expect(entries.find(e => e.bggId === 100)?.facts?.booth).toBe('5-X10')
    expect(entries.find(e => e.bggId === 201)).toEqual(typed)
  })

  it('loads a geeklist without facts the same way', async () => {
    const bgg = fakeApi(clock, { pageCount: 2 })
    const loader = loaderFor(bgg.api)
    const list = await loader.open('geeklist', 66420)
    await loader.idle()
    expect(list.isEssen).toBe(false)
    expect((await store.list('geeklist', 66420))?.loadedPages).toBe(2)
  })
})
