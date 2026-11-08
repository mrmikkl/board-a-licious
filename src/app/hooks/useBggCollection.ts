import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { type Api, ApiError } from '../../client/api.ts'
import type { Store } from '../../client/store.ts'
import type { StoredBggCollection } from '../../client/types.ts'
import type { Status } from '../../domain/bgg-status.ts'
import { useServices, useStoreData } from '../context.tsx'
import { type LoadOutcome, isFresh, nextCollection, nextRetry, statusMap } from './bgg-collection-state.ts'

export type BggCollectionProblem = 'offline' | 'unavailable' | null

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// one load per person and BGG user at a time, however many screens ask (badges show in many places)
const running = new Map<string, Promise<LoadOutcome>>()

// the loads waiting while BGG prepares a collection, so every screen asking for that user says so
const preparing = new Set<string>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
const keyOf = (store: Store, user: string) => `${store.email}|${user.toLowerCase()}`

/** Reads the collection from the Worker, asking again while BGG prepares it (FR-005), and stores the result. */
function load(store: Store, api: Api, user: string, fresh: boolean): Promise<LoadOutcome> {
  const key = keyOf(store, user)
  const pending = running.get(key)
  if (pending) return pending
  const started = (async (): Promise<LoadOutcome> => {
    const startedAt = Date.now()
    let outcome: LoadOutcome = { kind: 'failed' }
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await api.bggCollection(user, fresh)
        if (result.kind === 'preparing') {
          const pause = nextRetry(attempt, startedAt, Date.now())
          if (pause === null) break
          if (!preparing.has(key)) {
            preparing.add(key)
            notify()
          }
          await sleep(Math.max(pause, result.retryAfter * 1000))
          continue
        }
        outcome = result
      } catch (error) {
        outcome = { kind: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'failed' }
      }
      break
    }
    const next = nextCollection(user, await store.bggCollection(user), outcome, Date.now())
    if (next && outcome.kind !== 'offline' && outcome.kind !== 'failed') await store.putBggCollection(next)
    return outcome
  })().finally(() => {
    running.delete(key)
    if (preparing.delete(key)) notify()
  })
  running.set(key, started)
  return started
}

/**
 * F008: a person's BGG collection (the person's own or a followed friend's). Shows the stored copy at
 * once, reads it again when older than an hour (FR-004) or on `refresh()`, and keeps the stored copy
 * and its time when offline (FR-006).
 */
export function useBggCollection(user: string | null) {
  const { store, api } = useServices()
  const stored = useStoreData(async s => ({ collection: user ? await s.bggCollection(user) : undefined }), [user])
  const [loading, setLoading] = useState(false)
  const isPreparing = useSyncExternalStore(subscribe, () => (user ? preparing.has(keyOf(store, user)) : false))
  const [problem, setProblem] = useState<BggCollectionProblem>(null)
  const mounted = useRef(true)
  const checked = useRef<string | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(
    async (fresh: boolean) => {
      if (!user) return
      setLoading(true)
      setProblem(null)
      const outcome = await load(store, api, user, fresh)
      if (!mounted.current) return
      setLoading(false)
      setProblem(outcome.kind === 'offline' ? 'offline' : outcome.kind === 'failed' ? 'unavailable' : null)
    },
    [store, api, user],
  )

  // once per user, as soon as the stored copy has been read
  useEffect(() => {
    if (!user || !stored || checked.current === user) return
    checked.current = user
    if (!isFresh(stored.collection?.loadedAt, Date.now())) void run(false)
  }, [user, stored, run])

  const collection: StoredBggCollection | undefined = user ? stored?.collection : undefined
  const refresh = useCallback(() => void run(true), [run])
  return { collection, loading, preparing: isPreparing, problem, refresh }
}

/** F008: the statuses of the person's own BGG collection by BGG id; empty without a username. */
export function useOwnBggStatuses(): Map<number, Status> {
  const username = useStoreData(s => s.bggUsername()) ?? null
  const { collection } = useBggCollection(username)
  return useMemo(() => statusMap(collection), [collection])
}
