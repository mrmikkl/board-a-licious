import type { SearchResult } from '../domain/bgg-search.ts'
import type { BggCollectionAnswer } from '../domain/bgg-status.ts'
import type { PricesAnswer } from '../domain/offers.ts'
import type { Collection, Entry } from '../domain/collection.ts'
import type { GameGallery } from '../domain/gallery.ts'
import type { LoadedList } from '../domain/lists.ts'
import type { FollowedBggUser, Game, ListKind, StoredListEntry, UserSetting } from './types.ts'

export type ApiErrorCode =
  | 'offline'
  | 'unauthenticated'
  | 'bad_request'
  | 'not_found'
  | 'bgg_unavailable'
  | 'bgg_rate_limited'
  | 'bgg_search_unavailable'
  | 'bgg_preparing'
  | 'bgg_signed_out'
  | 'bgg_refused'
  | 'price_conflict'
  | 'internal'

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

export type ListPage = {
  kind: ListKind
  id: number
  title: string
  page: number
  pageCount: number
  entries: StoredListEntry[]
}

export type SyncChanges = {
  collections: Collection[]
  entries: Entry[]
  lists?: LoadedList[]
  settings?: UserSetting[]
  follows?: FollowedBggUser[]
}
export type SyncPull = SyncChanges & { serverTime: string }

/** F008: `GET /api/bgg/collection`: the collection, BGG still preparing it, or no such user. */
export type BggCollectionResult =
  | { kind: 'loaded'; answer: BggCollectionAnswer }
  | { kind: 'preparing'; retryAfter: number }
  | { kind: 'not_found' }

/** Seconds to wait when a 202 carries no usable Retry-After. */
const DEFAULT_RETRY_AFTER = 5

/** Thin fetch wrapper for /api (contracts/api.md); every failure becomes an ApiError. */
export function createApi(deps: { fetch?: typeof fetch; base?: string; onUnauthenticated?: () => void } = {}) {
  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init))
  const base = deps.base ?? ''

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    return (await send(path, init)).json() as Promise<T>
  }

  /** The successful response itself (any 2xx); every failure becomes an ApiError. */
  async function send(path: string, init?: RequestInit): Promise<Response> {
    let res: Response
    try {
      // never follow redirects: Cloudflare Access answers an expired session with a redirect to its
      // login page, which must not be mistaken for being offline or for data
      res = await doFetch(`${base}${path}`, { credentials: 'same-origin', redirect: 'manual', ...init })
    } catch (error) {
      if (init?.signal?.aborted) throw error
      throw new ApiError('offline', 'No connection. Your changes are kept and sent later.', true)
    }
    if (res.type === 'opaqueredirect' || res.status === 401) {
      deps.onUnauthenticated?.()
      throw new ApiError('unauthenticated', 'Your sign-in has expired. Sign in again to sync.', false)
    }
    if (res.ok) return res
    let body: { error?: ApiErrorCode; message?: string; retryable?: boolean } = {}
    try {
      body = await res.json()
    } catch {
      // Access redirects or HTML error pages: treat as a temporary server problem
    }
    throw new ApiError(body.error ?? 'internal', body.message ?? `The server answered ${res.status}.`, body.retryable ?? res.status >= 500)
  }

  // F004: galleries asked for in this session, by game; a failure is not kept (research R3)
  const galleries = new Map<number, Promise<GameGallery>>()
  const gallery = (bggId: number) => {
    let pending = galleries.get(bggId)
    if (!pending) {
      pending = call<GameGallery>(`/api/bgg/images?id=${bggId}`)
      galleries.set(bggId, pending)
      pending.catch(() => galleries.delete(bggId))
    }
    return pending
  }

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    me: () => call<{ email: string; bggSearch: boolean }>('/api/me'),
    pull: (since?: string) => call<SyncPull>(`/api/sync${since ? `?since=${encodeURIComponent(since)}` : ''}`),
    push: (changes: SyncChanges) =>
      call<{ applied: number; ignored: number }>('/api/sync', post(changes)),
    games: (ids: number[]) => call<{ games: Game[] }>(`/api/bgg/games?ids=${ids.join(',')}`).then(r => r.games),
    listPage: (kind: ListKind, id: number, page: number) => call<ListPage>(`/api/bgg/lists/${kind}/${id}?page=${page}`),
    companies: (ids: number[]) =>
      call<{ companies: { id: number; name: string }[] }>(`/api/bgg/companies?ids=${ids.join(',')}`).then(r => r.companies),
    gallery,
    /** F008: a person's BGG collection; `fresh` skips the Worker's edge cache (only on Refresh). */
    async bggCollection(user: string, fresh = false): Promise<BggCollectionResult> {
      try {
        const res = await send(`/api/bgg/collection?user=${encodeURIComponent(user)}${fresh ? '&fresh=1' : ''}`)
        if (res.status === 202) {
          const seconds = Number(res.headers.get('Retry-After'))
          return { kind: 'preparing', retryAfter: Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER }
        }
        return { kind: 'loaded', answer: (await res.json()) as BggCollectionAnswer }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'not_found') return { kind: 'not_found' }
        throw error
      }
    },
    /** F007: offers and links for a game (contracts/api.md of feature 007) */
    prices: (bggId: number, name: string) => call<PricesAnswer>(`/api/prices?bggId=${bggId}&name=${encodeURIComponent(name)}`),
    /** F006: ranked games and expansions for a name (contracts/api.md); covers come through `games`. */
    search: (q: string, limit: number, signal?: AbortSignal) =>
      call<{ query: string; results: SearchResult[] }>(`/api/bgg/search?q=${encodeURIComponent(q)}&limit=${limit}`, { signal }).then(r => r.results),
  }
}

export type Api = ReturnType<typeof createApi>
