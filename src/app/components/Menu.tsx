import { type ReactNode, useEffect, useRef } from 'react'

import { useServices, useStoreData } from '../context.tsx'
import { type Route, href, navigate } from '../router.ts'
import { IconBuy, IconConfig, IconLists } from './icons.tsx'

type Place = 'buy' | 'lists' | 'config'

const PLACES: { name: Place; label: string; icon: ReactNode }[] = [
  // F007: Buy is the first place
  { name: 'buy', label: 'Buy', icon: <IconBuy /> },
  { name: 'lists', label: 'Lists', icon: <IconLists /> },
  { name: 'config', label: 'Config', icon: <IconConfig /> },
]

/** The menu place a route belongs to (F008 contracts/ui.md). */
function place(route: Route): Place {
  switch (route.name) {
    case 'buy':
    case 'collections':
    case 'collection':
    case 'showoff':
    case 'swipe':
    case 'shared':
      return 'buy'
    case 'lists':
    case 'list':
    case 'status-list':
      return 'lists'
    case 'config':
    case 'share':
      return 'config'
  }
}

/**
 * The app bar's menu (research R2): a disclosure with links, not an ARIA menu. Focus moves to the
 * current place on open; Esc, a scrim tap and choosing a place close it. F008: each place opens on its
 * last used tab (Lists finds it itself).
 */
export function Menu({ id, route, top, onClose }: { id: string; route: Route; top: number; onClose: (refocus: boolean) => void }) {
  const current = place(route)
  const currentLink = useRef<HTMLAnchorElement>(null)
  const { store } = useServices()
  const lastTab = useStoreData(s => s.metaOrDefault('lastTab'))
  useEffect(() => currentLink.current?.focus(), [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  const target = (p: Place, last = lastTab): Route => (p === 'buy' ? (last?.buy === 'shopping' ? { name: 'collections' } : { name: 'buy' }) : { name: p })

  return (
    <>
      <div className="menu-scrim" onClick={() => onClose(true)} />
      <nav id={id} className="menu" aria-label="Menu" style={{ top }}>
        <ul>
          {PLACES.map(p => (
            <li key={p.name}>
              <a
                ref={p.name === current ? currentLink : undefined}
                href={href(target(p.name))}
                aria-current={p.name === current ? 'page' : undefined}
                onClick={event => {
                  onClose(false)
                  // tapped before the last tab was read from the device: read it first (Buy opens on it)
                  if (p.name !== 'buy' || lastTab) return
                  event.preventDefault()
                  void store.metaOrDefault('lastTab').then(last => navigate(target('buy', last)))
                }}
              >
                {p.icon}
                <span>{p.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
