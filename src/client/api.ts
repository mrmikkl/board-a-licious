import type { SearchResult } from '../domain/bgg-search.ts'
import type { BggCollectionAnswer, PrivateInfo, Status, StatusChange } from '../domain/bgg-status.ts'
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
    /** The error answer's other fields (F008: `current` of a price conflict). */
    readonly body: Record<string, unknown> = {},
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

/** F008: `GET /api/bgg/account` and the sign-in answer; the cookie decides, the app only shows it. */
export type BggAccount = { signedIn: true; bggUser: string } | { signedIn: false }

/** F008: `POST /api/bgg/account/collection/<bggId>`: only the changed keys, the private info once after buying. */
export type BggSaveBody = { status?: StatusChange; privateInfo?: PrivateInfo; replacePrice?: boolean }
export type Money = { amount: number; currency: string }
/** Saved (the statuses as BGG has them now), or BGG already has another price paid (nothing written). */
export type BggSaveResult = { kind: 'saved'; status: Status } | { kind: 'conflict'; current: Money }

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
      // F008: BGG refused the person's BGG session or password; the app's own sign-in is fine
      if (res.status === 401) {
        const body = await res.clone().json().catch(() => ({})) as { error?: string; message?: string }
        if (body.error === 'bgg_signed_out') throw new ApiError('bgg_signed_out', body.message ?? 'Sign in to BoardGameGeek.', false)
      }
      deps.onUnauthenticated?.()
      throw new ApiError('unauthenticated', 'Your sign-in has expired. Sign in again to sync.', false)
    }
    if (res.ok) return res
    let body: { error?: ApiErrorCode; message?: string; retryable?: boolean; [key: string]: unknown } = {}
    try {
      body = await res.json()
    } catch {
      // Access redirects or HTML error pages: treat as a temporary server problem
    }
    throw new ApiError(body.error ?? 'internal', body.message ?? `The server answered ${res.status}.`, body.retryable ?? res.status >= 500, body)
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
    /** F008 (US3): who is signed in to BGG on this device; reads only the cookie. */
    account: () => call<BggAccount>('/api/bgg/account'),
    /** F008 (US3): the password goes into this one request and nowhere else. */
    signIn: (username: string, password: string) => call<BggAccount>('/api/bgg/account/signin', post({ username, password })),
    signOut: () => call<BggAccount>('/api/bgg/account/signout', post({})),
    /** F008 (US4, US5): writes the signed-in person's own BGG collection; 409 is the price conflict. */
    async saveStatus(bggId: number, body: BggSaveBody): Promise<BggSaveResult> {
      try {
        const saved = await call<{ status: Status }>(`/api/bgg/account/collection/${bggId}`, post(body))
        return { kind: 'saved', status: saved.status }
      } catch (error) {
        const current = error instanceof ApiError && error.code === 'price_conflict' ? (error.body.current as Money | undefined) : undefined
        if (current) return { kind: 'conflict', current }
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
