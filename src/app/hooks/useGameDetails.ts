import { useCallback, useEffect, useState } from 'react'

import { useServices } from '../context.tsx'
import { missingIds, readDetails } from './game-details-state.ts'

export type DetailsReading = {
  /** Games in the list (distinct ids). */
  total: number
  /** Games whose details are on the device. */
  known: number
  reading: boolean
  /** Why the last read stopped early; the games left out stay unfiltered until Try again. */
  failure: 'offline' | 'failed' | null
  retry: () => void
}

/**
 * US4: reads the missing details of a list's games while `active` (a filter sheet is open or a filter
 * is set), in chunks of 40 through `/api/bgg/games`, storing each answer so the screen re-reads it.
 * Details on the device are never asked for again (FR-009).
 */
export function useGameDetails(ids: number[], active: boolean): DetailsReading {
  const { store, api } = useServices()
  const key = ids.join(',')
  const total = new Set(ids).size
  // while the ids change (pages of a list arriving) the last numbers stay until the new ones are read
  const [state, setState] = useState<{ known: number; reading: boolean; failure: DetailsReading['failure'] }>({ known: 0, reading: false, failure: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    const list = key ? key.split(',').map(Number) : []
    void (async () => {
      const missing = missingIds(list, await store.games(list))
      if (!live) return
      const base = new Set(list).size - missing.length
      const run = active && missing.length > 0
      setState({ known: base, reading: run, failure: null })
      if (!run) return
      const outcome = await readDetails({
        ids: missing,
        api,
        store,
        onProgress: arrived => live && setState(s => ({ ...s, known: base + arrived })),
        cancelled: () => !live,
      })
      if (!live) return
      setState(s => ({ ...s, reading: false, failure: outcome.kind === 'offline' || outcome.kind === 'failed' ? outcome.kind : null }))
    })()
    return () => {
      live = false
    }
  }, [store, api, key, active, attempt])

  const retry = useCallback(() => setAttempt(n => n + 1), [])
  return { total, known: Math.min(state.known, total), reading: state.reading, failure: state.failure, retry }
}
