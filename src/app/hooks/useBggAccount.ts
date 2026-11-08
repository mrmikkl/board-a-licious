import { useCallback, useEffect, useState } from 'react'

import type { BggSaveBody, BggSaveResult } from '../../client/api.ts'
import type { Store } from '../../client/store.ts'
import type { BggCollectionItem } from '../../domain/bgg-status.ts'
import { type AppServices, useServices, useStoreData } from '../context.tsx'
import { withSavedStatus } from './bgg-collection-state.ts'

// one `GET /api/bgg/account` at a time per person, however many screens ask
const asking = new Map<Store, Promise<void>>()

/** Refreshes meta `bggSignedInAs` from the cookie; offline or failing keeps the hint as it is. */
function refresh({ store, api }: AppServices): Promise<void> {
  let pending = asking.get(store)
  if (!pending) {
    pending = api
      .account()
      .then(async account => {
        const name = account.signedIn ? account.bggUser : null
        if ((await store.metaOrDefault('bggSignedInAs')) !== name) await store.setMeta('bggSignedInAs', name)
      })
      .catch(() => undefined)
      .finally(() => asking.delete(store))
    asking.set(store, pending)
  }
  return pending
}

/**
 * F008 (US3): who is signed in to BoardGameGeek on this device. The HttpOnly cookie decides; the app
 * keeps only meta `bggSignedInAs` as a hint (undefined while it is read), refreshed on every use.
 * The password lives in the sign-in field and the one request; it is never stored or logged.
 */
export function useBggAccount() {
  const services = useServices()
  const signedInAs = useStoreData(store => store.metaOrDefault('bggSignedInAs'))
  useEffect(() => {
    void refresh(services)
  }, [services])

  const signIn = useCallback(
    async (username: string, password: string) => {
      const account = await services.api.signIn(username, password)
      const name = account.signedIn ? account.bggUser : username
      await services.store.setMeta('bggSignedInAs', name)
      // US3 #2: reading uses the same name when none was set
      if (!(await services.store.bggUsername())) {
        await services.store.setBggUsername(name)
        void services.sync.schedule()
      }
      return name
    },
    [services],
  )

  const signOut = useCallback(async () => {
    await services.api.signOut()
    await services.store.setMeta('bggSignedInAs', null)
  }, [services])

  return { signedInAs, signIn, signOut }
}

/**
 * F008 (US4, US5): one save on BGG; afterwards the stored copy of the person's own collection holds
 * the new statuses, so badges and status lists show them at once (FR-017). A 401 clears the hint.
 */
export async function saveOnBgg(
  { store, api }: AppServices,
  username: string | null,
  game: Omit<BggCollectionItem, 'status'>,
  body: BggSaveBody,
): Promise<BggSaveResult> {
  try {
    const result = await api.saveStatus(game.bggId, body)
    if (result.kind === 'saved' && username) await store.putBggCollection(withSavedStatus(username, await store.bggCollection(username), game, result.status))
    return result
  } catch (error) {
    if ((error as { code?: string }).code === 'bgg_signed_out') await store.setMeta('bggSignedInAs', null)
    throw error
  }
}

/** navigator.onLine, kept up to date by the online/offline events. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
