import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import type { Game } from '../../client/types.ts'
import { searchQuery } from '../../domain/bgg-search.ts'
import { useServices } from '../context.tsx'
import { initialSearch, searchReducer } from './search-state.ts'

/** Research R8: a search runs this long after the last keystroke (SC-005). */
export const SEARCH_PAUSE_MS = 500
/** When BGG asks to wait: tries and the pause between them before "not reachable". */
const WAIT_TRIES = 3
const WAIT_MS = 3000
/** Covers come through /api/bgg/games, 20 games per request. */
const COVER_CHUNK = 20

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * F006: BoardGameGeek search by name for the Search place (limit 50) and Add game (limit 8): a pause in
 * typing, only the newest answer shown, then covers and details for the results.
 */
export function useBggSearch(limit: number) {
  const { api } = useServices()
  const [state, dispatch] = useReducer(searchReducer, initialSearch)
  const [games, setGames] = useState<Map<number, Game>>(() => new Map())
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<AbortController>(undefined)
  const known = useRef(games)
  known.current = games

  const loadCovers = useCallback(
    async (ids: number[], mine: number) => {
      const missing = ids.filter(id => !known.current.has(id))
      for (let i = 0; i < missing.length && mine === seq.current; i += COVER_CHUNK) {
        try {
          const found = await api.games(missing.slice(i, i + COVER_CHUNK))
          setGames(current => new Map([...current, ...found.map(g => [g.bggId, g] as const)]))
        } catch {
          return // covers are a nicety: rows keep their initials
        }
      }
    },
    [api],
  )

  const run = useCallback(
    async (text: string) => {
      clearTimeout(timer.current)
      const query = searchQuery(text)
      if (!query.ok) return
      pending.current?.abort()
      const controller = new AbortController()
      pending.current = controller
      const mine = ++seq.current
      dispatch({ type: 'start', seq: mine })
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return dispatch({ type: 'failed', seq: mine, reason: 'offline' })
      for (let attempt = 1; ; attempt++) {
        try {
          const results = await api.search(query.text, limit, controller.signal)
          dispatch({ type: 'results', seq: mine, results })
          void loadCovers(
            results.map(r => r.bggId),
            mine,
          )
          return
        } catch (error) {
          if (controller.signal.aborted) return
          const code = error instanceof ApiError ? error.code : 'internal'
          if (code === 'bgg_rate_limited' && attempt < WAIT_TRIES) {
            dispatch({ type: 'waiting', seq: mine })
            await sleep(WAIT_MS)
            if (controller.signal.aborted) return
            continue
          }
          return dispatch({ type: 'failed', seq: mine, reason: code === 'offline' ? 'offline' : 'unavailable' })
        }
      }
    },
    [api, limit, loadCovers],
  )

  /** The text changed: search after a pause. */
  const change = useCallback(
    (text: string) => {
      clearTimeout(timer.current)
      pending.current?.abort()
      seq.current++
      dispatch({ type: 'input', text })
      if (searchQuery(text).ok) timer.current = setTimeout(() => void run(text), SEARCH_PAUSE_MS)
    },
    [run],
  )

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      pending.current?.abort()
    },
    [],
  )

  return { state, games, change, searchNow: () => void run(state.text), retry: () => void run(state.text) }
}
