import type { Collection, Entry } from '../domain/collection.ts'
import type { LoadedList } from '../domain/lists.ts'
import type { Game, ListKind, StoredListEntry } from './types.ts'

export type ApiErrorCode =
  | 'offline'
  | 'unauthenticated'
  | 'bad_request'
  | 'not_found'
  | 'bgg_unavailable'
  | 'bgg_rate_limited'
  | 'bgg_search_unavailable'
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

export type SyncPull = { collections: Collection[]; entries: Entry[]; lists?: LoadedList[]; serverTime: string }

/** Thin fetch wrapper for /api (contracts/api.md); every failure becomes an ApiError. */
export function createApi(deps: { fetch?: typeof fetch; base?: string; onUnauthenticated?: () => void } = {}) {
  const doFetch = deps.fetch ?? ((input, init) => fetch(input, init))
  const base = deps.base ?? ''

  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response
    try {
      // never follow redirects: Cloudflare Access answers an expired session with a redirect to its
      // login page, which must not be mistaken for being offline or for data
      res = await doFetch(`${base}${path}`, { credentials: 'same-origin', redirect: 'manual', ...init })
    } catch {
      throw new ApiError('offline', 'No connection. Your changes are kept and sent later.', true)
    }
    if (res.type === 'opaqueredirect' || res.status === 401) {
      deps.onUnauthenticated?.()
      throw new ApiError('unauthenticated', 'Your sign-in has expired. Sign in again to sync.', false)
    }
    if (res.ok) return (await res.json()) as T
    let body: { error?: ApiErrorCode; message?: string; retryable?: boolean } = {}
    try {
      body = await res.json()
    } catch {
      // Access redirects or HTML error pages: treat as a temporary server problem
    }
    throw new ApiError(body.error ?? 'internal', body.message ?? `The server answered ${res.status}.`, body.retryable ?? res.status >= 500)
  }

  const post = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    me: () => call<{ email: string; bggSearch: boolean }>('/api/me'),
    pull: (since?: string) => call<SyncPull>(`/api/sync${since ? `?since=${encodeURIComponent(since)}` : ''}`),
    push: (changes: { collections: Collection[]; entries: Entry[]; lists?: LoadedList[] }) =>
      call<{ applied: number; ignored: number }>('/api/sync', post(changes)),
    games: (ids: number[]) => call<{ games: Game[] }>(`/api/bgg/games?ids=${ids.join(',')}`).then(r => r.games),
    listPage: (kind: ListKind, id: number, page: number) => call<ListPage>(`/api/bgg/lists/${kind}/${id}?page=${page}`),
    companies: (ids: number[]) =>
      call<{ companies: { id: number; name: string }[] }>(`/api/bgg/companies?ids=${ids.join(',')}`).then(r => r.companies),
    search: (q: string) => call<{ games: Game[] }>(`/api/bgg/search?q=${encodeURIComponent(q)}`).then(r => r.games),
  }
}

export type Api = ReturnType<typeof createApi>
