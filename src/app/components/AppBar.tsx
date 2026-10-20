import { useCallback, useEffect, useId, useRef, useState } from 'react'

import type { Route } from '../router.ts'
import { IconMenu } from './icons.tsx'
import { Menu } from './Menu.tsx'

/**
 * The band at the top of every screen (docs/design.md §7 "App bar"): logo, name and ☰, which opens
 * the menu. Without a route (boot screens) there is no menu button.
 */
export function AppBar({ route }: { route?: Route }) {
  const [menuTop, setMenuTop] = useState<number>()
  const bar = useRef<HTMLElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const open = menuTop !== undefined

  const close = useCallback((refocus: boolean) => {
    setMenuTop(undefined)
    if (refocus) button.current?.focus()
  }, [])
  // any route change closes the menu
  useEffect(() => setMenuTop(undefined), [route])

  return (
    <>
      <header className="appbar" ref={bar}>
        <img className="appbar-logo" src="/icons/logo.png" alt="" />
        <span className="appbar-name">Board-a-licious</span>
        {route && (
          <button
            ref={button}
            type="button"
            className="menu-btn"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => (open ? close(false) : setMenuTop(bar.current?.getBoundingClientRect().bottom ?? 0))}
          >
            <IconMenu />
          </button>
        )}
      </header>
      {open && route && <Menu id={menuId} route={route} top={menuTop} onClose={close} />}
    </>
  )
}
