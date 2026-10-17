import { type ReactNode, createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'

import { type Api, ApiError, createApi } from '../client/api.ts'
import { completeDetails } from '../client/details.ts'
import { type Store, openStore } from '../client/store.ts'
import { type Sync, createSync } from '../client/sync.ts'

export type AppServices = {
  store: Store
  api: Api
  sync: Sync
  email: string
  bggSearch: boolean
  /** Fetches BGG details for link-added games and games new on this device (FR-017); never throws. */
  completeDetails: () => Promise<void>
}

const Services = createContext<AppServices | null>(null)
const LAST_EMAIL = 'bal-last-email'

type Boot = { state: 'loading' } | { state: 'ready'; services: AppServices } | { state: 'signed-out' } | { state: 'error'; message: string }

function rememberedEmail(): string | null {
  try {
    return localStorage.getItem(LAST_EMAIL)
  } catch {
    return null
  }
}

/** Finds out who is signed in (offline: the last person on this device), opens their store, starts sync. */
export function AppProvider({ children, fallback }: { children: ReactNode; fallback: (boot: Exclude<Boot, { state: 'ready' }>) => ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' })

  useEffect(() => {
    let stop: (() => void) | undefined
    let store: Store | undefined
    let cancelled = false
    ;(async () => {
      const api = createApi()
      let email: string | null = null
      let bggSearch = false
      try {
        const me = await api.me()
        email = me.email
        bggSearch = me.bggSearch
        try {
          localStorage.setItem(LAST_EMAIL, email)
        } catch {
          // private mode: fine, offline start just needs a sign-in first
        }
      } catch (error) {
        if (error instanceof ApiError && error.code === 'unauthenticated') return setBoot({ state: 'signed-out' })
        email = rememberedEmail()
        if (!email) return setBoot({ state: 'error', message: 'Connect once to sign in; after that the app also works offline.' })
      }
      store = await openStore(email)
      if (cancelled) return store.close()
      const sync = createSync({ store, api })
      const details = detailsRunner(store, api, sync)
      const stopSync = sync.start()
      // after the first sync and after coming back online, so games from other devices get details too
      const afterSync = () => void sync.idle().then(details)
      afterSync()
      window.addEventListener('online', afterSync)
      stop = () => {
        stopSync()
        window.removeEventListener('online', afterSync)
      }
      setBoot({ state: 'ready', services: { store, api, sync, email, bggSearch, completeDetails: details } })
    })().catch(error => setBoot({ state: 'error', message: String(error) }))
    return () => {
      cancelled = true
      stop?.()
      store?.close()
    }
  }, [])

  if (boot.state !== 'ready') return <>{fallback(boot)}</>
  return <Services.Provider value={boot.services}>{children}</Services.Provider>
}

/** One run at a time; a call during a run starts one more run afterwards, so new entries are not missed. */
function detailsRunner(store: Store, api: Api, sync: Sync) {
  let running: Promise<void> | undefined
  let again = false
  const run = async () => {
    do {
      again = false
      const completed = await completeDetails({ store, api, now: () => new Date().toISOString() }).catch(() => 0)
      if (completed > 0) void sync.schedule()
    } while (again)
  }
  return () => {
    if (running) {
      again = true
      return running
    }
    running = run().finally(() => {
      running = undefined
    })
    return running
  }
}

export function useServices(): AppServices {
  const services = useContext(Services)
  if (!services) throw new Error('useServices outside AppProvider')
  return services
}

/** Re-reads `read()` whenever the store changes (local edits or sync). */
export function useStoreData<T>(read: (store: Store) => Promise<T>, deps: unknown[] = []): T | undefined {
  const { store } = useServices()
  const version = useSyncExternalStore(
    listener => store.subscribe(listener),
    () => storeVersion(store),
  )
  const [value, setValue] = useState<T>()
  useEffect(() => {
    let current = true
    void read(store).then(result => current && setValue(result))
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, ...deps])
  return value
}

const versions = new WeakMap<Store, number>()
const subscribed = new WeakSet<Store>()
function storeVersion(store: Store) {
  if (!subscribed.has(store)) {
    subscribed.add(store)
    store.subscribe(() => versions.set(store, (versions.get(store) ?? 0) + 1))
  }
  return versions.get(store) ?? 0
}
