import { type ReactNode, useEffect, useRef } from 'react'

import { type Route, href } from '../router.ts'
import { IconCollections, IconConfig, IconLists, IconSearch } from './icons.tsx'

type Place = 'collections' | 'lists' | 'search' | 'config'

const PLACES: { name: Place; label: string; icon: ReactNode }[] = [
  { name: 'collections', label: 'Collections', icon: <IconCollections /> },
  { name: 'lists', label: 'BGG lists', icon: <IconLists /> },
  { name: 'search', label: 'Search', icon: <IconSearch /> },
  { name: 'config', label: 'Config', icon: <IconConfig /> },
]

/** The menu place a route belongs to (contracts/navigation.md "Menu"). */
function place(route: Route): Place {
  switch (route.name) {
    case 'collection':
    case 'swipe':
    case 'shared':
      return 'collections'
    case 'list':
      return 'lists'
    case 'share':
      return 'config'
    default:
      return route.name
  }
}

/**
 * The app bar's menu (research R2): a disclosure with links, not an ARIA menu. Focus moves to the
 * current place on open; Esc, a scrim tap and choosing a place close it.
 */
export function Menu({ id, route, top, onClose }: { id: string; route: Route; top: number; onClose: (refocus: boolean) => void }) {
  const current = place(route)
  const currentLink = useRef<HTMLAnchorElement>(null)
  useEffect(() => currentLink.current?.focus(), [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="menu-scrim" onClick={() => onClose(true)} />
      <nav id={id} className="menu" aria-label="Menu" style={{ top }}>
        <ul>
          {PLACES.map(p => (
            <li key={p.name}>
              <a
                ref={p.name === current ? currentLink : undefined}
                href={href({ name: p.name })}
                aria-current={p.name === current ? 'page' : undefined}
                onClick={() => onClose(false)}
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
