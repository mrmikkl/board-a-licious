import { mergeListEntries } from '../domain/lists.ts'
import { refreshPreviewFacts } from '../domain/facts.ts'
import type { Api, ListPage } from './api.ts'
import type { Store } from './store.ts'
import type { ListKind, StoredList, StoredListEntry } from './types.ts'

const MIN_GAP_MS = 1000
const RELOAD_AFTER_MS = 3600_000
const COMPANIES_PER_REQUEST = 10
export const LIST_ERROR = 'BoardGameGeek is not reachable.'

const PAUSED = Symbol('paused')

/**
 * Loads BGG lists into the device (FR-012, research R9): page 1 at once, the other pages one by one
 * at most one request per second, then missing publisher names. Progress lives in the `lists` store,
 * so loading resumes after a reload. Constitution V "on user demand": pages load only while the list
 * is open somewhere and the app is in the foreground. A failed request pauses the list with an error
 * until `retry` or the next `open`.
 */
export function createListLoader(deps: {
  store: Store
  api: Api
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  foreground?: () => boolean
  events?: EventTarget
  /** Called when a list was queued for the person's other devices, so it is sent right away. */
  onQueued?: () => void
}) {
  const { store, api } = deps
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)))
  const foreground = deps.foreground ?? (() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  const events = deps.events ?? (typeof document !== 'undefined' ? document : undefined)
  const iso = () => new Date(now()).toISOString()
  const keyOf = (kind: ListKind, id: number) => `${kind}:${id}`

  const opened = new Map<string, number>()
  const running = new Map<string, Promise<void>>()
  const retries = new Set<Promise<void>>()
  const again = new Set<string>()
  const active = (key: string) => (opened.get(key) ?? 0) > 0 && foreground()

  // one request at a time across all lists, at least MIN_GAP_MS apart
  let lastRequest = -Infinity
  let queue: Promise<unknown> = Promise.resolve()
  function throttled<T>(key: string | null, task: () => Promise<T>): Promise<T | typeof PAUSED> {
    const run = queue.then(async () => {
      const wait = lastRequest + MIN_GAP_MS - now()
      if (wait > 0) await sleep(wait)
      if (key !== null && !active(key)) return PAUSED
      lastRequest = now()
      return task()
    })
    queue = run.catch(() => undefined)
    return run
  }

  // list writes per list run one after the other, so open and the background run never overwrite each other
  const writes = new Map<string, Promise<unknown>>()
  function update(kind: ListKind, id: number, change: (list: StoredList | undefined) => Promise<StoredList> | StoredList) {
    const key = keyOf(kind, id)
    const run = (writes.get(key) ?? Promise.resolve()).then(async () => {
      const list = await change(await store.list(kind, id))
      await store.putList(list)
      return list
    })
    writes.set(key, run.catch(() => undefined))
    return run
  }

  /** Publisher names: those BGG sent are remembered, missing ones filled from the device. */
  async function withPublishers(entries: StoredListEntry[]) {
    const named: Record<number, string> = {}
    const missing: number[] = []
    for (const { facts } of entries) {
      if (facts?.publisherId == null) continue
      if (facts.publisher) named[facts.publisherId] = facts.publisher
      else missing.push(facts.publisherId)
    }
    if (Object.keys(named).length > 0) await store.putPublishers(named)
    const known = { ...(await store.publishers([...new Set(missing)])), ...named }
    return entries.map(e =>
      e.facts?.publisherId != null && !e.facts.publisher && known[e.facts.publisherId]
        ? { ...e, facts: { ...e.facts, publisher: known[e.facts.publisherId] } }
        : e,
    )
  }

  /** Fresh preview data updates the facts of collection entries that came from a preview. */
  async function refreshCollections(list: StoredList, entries: StoredListEntry[]) {
    if (!list.isEssen) return
    const fresh = new Map(entries.filter(e => e.facts).map(e => [e.bggId, e.facts!]))
    const changed = refreshPreviewFacts(await store.allEntries(), fresh, iso())
    if (changed.length > 0) await store.saveEntries(changed)
  }

  async function storePage(kind: ListKind, id: number, page: ListPage) {
    const fresh = (await withPublishers(page.entries)).map(e => ({ ...e, page: page.page }))
    let entries: StoredListEntry[] = []
    const list = await update(kind, id, old => {
      // a reload replaces the page's old items; games listed on several pages merge into one row
      const items = [...(old?.items ?? []).filter(e => e.page !== page.page), ...fresh]
      entries = mergeListEntries(items)
      return {
      kind,
      id,
      title: page.title,
      isEssen: page.isEssen,
      pageCount: page.pageCount,
      loadedPages: page.page,
      items,
      entries,
      openedAt: old?.openedAt ?? iso(),
      loadedAt: old?.loadedAt,
      }
    })
    await refreshCollections(list, entries.filter(e => fresh.some(f => f.bggId === e.bggId)))
    return list
  }

  /** After the last page: ask for the publishers still unnamed, then mark the list complete. */
  async function finish(kind: ListKind, id: number, list: StoredList): Promise<boolean> {
    const missing = [...new Set(list.entries.flatMap(e => (e.facts?.publisherId != null && !e.facts.publisher ? [e.facts.publisherId] : [])))]
    const names: Record<number, string> = {}
    for (let i = 0; i < missing.length; i += COMPANIES_PER_REQUEST) {
      const found = await throttled(keyOf(kind, id), () => api.companies(missing.slice(i, i + COMPANIES_PER_REQUEST)))
      if (found === PAUSED) return false
      for (const company of found) names[company.id] = company.name
    }
    if (Object.keys(names).length > 0) await store.putPublishers(names)
    const done = await update(kind, id, async old => {
      const current = old ?? list
      const items = (await withPublishers(current.items ?? current.entries)).filter(e => (e.page ?? 1) <= current.pageCount)
      return { ...current, items, entries: mergeListEntries(items), loadedAt: iso() }
    })
    if (Object.keys(names).length > 0) await refreshCollections(done, done.entries)
    return true
  }

  async function work(kind: ListKind, id: number) {
    const key = keyOf(kind, id)
    try {
      while (active(key)) {
        const list = await store.list(kind, id)
        if (!list || list.error) return
        if (list.loadedPages >= list.pageCount) {
          if (!list.loadedAt) await finish(kind, id, list)
          return
        }
        const page = await throttled(key, () => api.listPage(kind, id, list.loadedPages + 1))
        if (page === PAUSED) return
        await storePage(kind, id, page)
      }
    } catch {
      await update(kind, id, old => ({ ...old!, error: LIST_ERROR }))
    }
  }

  function start(kind: ListKind, id: number) {
    const key = keyOf(kind, id)
    if (running.has(key)) {
      again.add(key)
      return
    }
    const run = work(kind, id).finally(() => {
      running.delete(key)
      if (again.delete(key) && active(key)) start(kind, id)
    })
    running.set(key, run)
  }

  const onVisibility = () => {
    if (!foreground()) return
    for (const [key, count] of opened) {
      if (count === 0) continue
      const [kind, id] = key.split(':') as [ListKind, string]
      start(kind, Number(id))
    }
  }
  events?.addEventListener('visibilitychange', onVisibility)

  function close(kind: ListKind, id: number) {
    const key = keyOf(kind, id)
    opened.set(key, Math.max(0, (opened.get(key) ?? 0) - 1))
  }

  return {
    /**
     * The list is in use (a screen shows it). A new list resolves once page 1 is stored and rejects
     * with the ApiError when page 1 fails; a known list resolves at once, reloading after 1 h.
     * Each `open` needs a `close`.
     */
    async open(kind: ListKind, id: number): Promise<StoredList> {
      const key = keyOf(kind, id)
      opened.set(key, (opened.get(key) ?? 0) + 1)
      try {
        let list = await store.list(kind, id)
        // not loaded yet, or only known from another device (no pages yet): page 1 now
        if (!list || list.pageCount === 0) {
          const known = Boolean(list)
          const page = await throttled(null, () => api.listPage(kind, id, 1))
          list = await storePage(kind, id, page as ListPage)
          if (!known) {
            await store.saveListRef({ kind, id, title: list.title, isEssen: list.isEssen, updatedAt: iso(), deleted: false })
            deps.onQueued?.()
          }
        } else {
          // lists loaded before lists were synced (no `items`) are queued once for the other devices
          if (list.items === undefined) {
            await store.saveListRef({ kind, id, title: list.title, isEssen: list.isEssen, updatedAt: iso(), deleted: false })
            deps.onQueued?.()
          }
          list = await update(kind, id, old => {
            const current = old ?? list!
            // lists stored before editions were merged (no `items`) reload once, to drop their duplicates
            const stale =
              current.items === undefined || (current.loadedAt !== undefined && now() - Date.parse(current.loadedAt) > RELOAD_AFTER_MS)
            return { ...current, openedAt: iso(), error: undefined, ...(stale ? { loadedPages: 0, loadedAt: undefined } : {}) }
          })
        }
        start(kind, id)
        return list
      } catch (error) {
        close(kind, id)
        throw error
      }
    },
    close,
    /** "Retry" after a failed page. */
    retry(kind: ListKind, id: number): Promise<void> {
      const run = (async () => {
        if (!(await store.list(kind, id))) return
        await update(kind, id, old => ({ ...old!, error: undefined }))
        start(kind, id)
      })()
      retries.add(run)
      return run.finally(() => retries.delete(run))
    },
    /** Resolves once no list is loading (finished, paused or failed). */
    async idle() {
      while (running.size > 0 || retries.size > 0) await Promise.all([...running.values(), ...retries])
    },
    dispose() {
      events?.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

export type ListLoader = ReturnType<typeof createListLoader>
