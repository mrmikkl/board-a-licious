import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import type { PriceLanguage } from '../../domain/offers.ts'
import type { PricesState } from '../components/OffersBlock.tsx'
import { useServices, useStoreData } from '../context.tsx'

/** F007 US3: the language choice for price lists, remembered on the device (Both by default). */
export function usePriceLanguage(): [PriceLanguage, (language: PriceLanguage) => void] {
  const { store } = useServices()
  const stored = useStoreData(s => s.meta('priceLanguage'))
  const set = useCallback((language: PriceLanguage) => void store.setMeta('priceLanguage', language), [store])
  return [stored ?? 'both', set]
}

/** F007: a game's offers from `/api/prices`, loaded only while `enabled` (a folded section loads nothing). */
export function usePrices(bggId: number, name: string | null | undefined, enabled = true) {
  const { api } = useServices()
  const [state, setState] = useState<PricesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || !name) return
    let active = true
    setState({ status: 'loading' })
    api.prices(bggId, name).then(
      answer => active && setState({ status: 'ready', answer }),
      (error: unknown) => active && setState({ status: 'error', offline: error instanceof ApiError && error.code === 'offline' }),
    )
    return () => {
      active = false
    }
  }, [api, bggId, name, enabled, attempt])
  return { state, retry: () => setAttempt(n => n + 1) }
}
