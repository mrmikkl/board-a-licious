import type { Collection, Entry } from '../domain/collection.ts'
import type { Api } from './api.ts'
import type { Store } from './store.ts'

const CHUNK = 500

/**
 * Keeps the device and the server in step (FR-022): push the outbox in chunks, then pull what changed
 * since the last sync. Runs on start, when the device comes back online and after each change.
 */
export function createSync(deps: { store: Store; api: Api; events?: EventTarget }) {
  const { store, api } = deps
  let running: Promise<void> | undefined
  let again = false

  async function once() {
    const pending = await store.pending()
    for (let i = 0; i < pending.length; i += CHUNK) {
      const chunk = pending.slice(i, i + CHUNK)
      const collections: Collection[] = []
      const entries: Entry[] = []
      for (const change of chunk) {
        if (change.kind === 'collection') collections.push(change.row)
        else entries.push(change.row)
      }
      await api.push({ collections, entries })
      await store.acknowledge(chunk.map(c => c.key))
    }
    const since = await store.meta('lastSyncAt')
    const pulled = await api.pull(since)
    await store.applyRemote(pulled)
    await store.setMeta('lastSyncAt', pulled.serverTime)
  }

  function syncNow(): Promise<void> {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      try {
        do {
          again = false
          await once()
        } while (again)
      } finally {
        running = undefined
      }
    })()
    return running
  }

  const quiet = () => syncNow().catch(() => undefined)

  return {
    syncNow,
    /** Call after a local change; failures are fine, the outbox keeps the change. */
    schedule: quiet,
    /** Resolves once no sync is running. */
    async idle() {
      while (running) await running.catch(() => undefined)
    },
    start() {
      const target = deps.events ?? (typeof window !== 'undefined' ? window : undefined)
      target?.addEventListener('online', quiet)
      void quiet()
      return () => target?.removeEventListener('online', quiet)
    },
  }
}

export type Sync = ReturnType<typeof createSync>
