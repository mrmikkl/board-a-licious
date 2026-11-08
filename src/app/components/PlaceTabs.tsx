import { type KeyboardEvent, useEffect, useRef } from 'react'

import type { MetaValues } from '../../client/store.ts'
import { useServices } from '../context.tsx'
import { type Route, navigate } from '../router.ts'

type LastTab = MetaValues['lastTab']
export type Place = keyof LastTab

export type PlaceTab<P extends Place> = { key: LastTab[P]; label: string; route: Route }

/** The id of a tab, so its panel can be labelled by it. */
export const tabId = (place: Place, key: string) => `tab-${place}-${key}`

/**
 * F008 (docs/design.md "Place tabs"): the tabs under a place's heading as an ARIA tablist. A tab is
 * an address of its own; the arrow keys, Home and End move between them and open the one they reach.
 * The tab on screen is remembered on the device (meta `lastTab`), so the menu opens the place on it.
 */
export function PlaceTabs<P extends Place>({ place, label, tabs, current }: { place: P; label: string; tabs: PlaceTab<P>[]; current: LastTab[P] }) {
  const { store } = useServices()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  useEffect(() => {
    let active = true
    void store.metaOrDefault('lastTab').then(last => {
      if (active && last[place] !== current) void store.setMeta('lastTab', { ...last, [place]: current })
    })
    return () => {
      active = false
    }
  }, [store, place, current])

  const go = (index: number) => {
    const to = (index + tabs.length) % tabs.length
    const tab = tabs[to]
    if (!tab) return
    refs.current[to]?.focus()
    navigate(tab.route)
  }
  const onKey = (event: KeyboardEvent, index: number) => {
    const to = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: tabs.length - 1 }[event.key]
    if (to === undefined) return
    event.preventDefault()
    go(to)
  }
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, i) => {
        const selected = tab.key === current
        return (
          <button
            key={tab.key}
            ref={el => {
              refs.current[i] = el
            }}
            id={tabId(place, tab.key)}
            type="button"
            role="tab"
            className="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => !selected && navigate(tab.route)}
            onKeyDown={e => onKey(e, i)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
