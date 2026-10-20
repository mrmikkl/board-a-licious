import type { ReactNode } from 'react'

type Target = { href?: string; onClick?: () => void }

/** A link when it goes somewhere (a route that opens a sheet), else a button. */
function Control({ href, onClick, className, label, disabled, children }: Target & { className: string; label?: string; disabled?: boolean; children: ReactNode }) {
  if (href && !disabled)
    return (
      <a className={className} href={href} aria-label={label} onClick={onClick}>
        {children}
      </a>
    )
  return (
    <button type="button" className={className} aria-label={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  )
}

/** The big hot hexagon, the screen's one orange action; disabled = raised grey, no shimmer (docs/design.md "Main button"). */
export function MainButton({ icon, label, disabled, ...target }: Target & { icon: ReactNode; label: string; disabled?: boolean }) {
  return (
    <Control {...target} className="main-btn hex hex-btn" label={label} disabled={disabled}>
      {icon}
    </Control>
  )
}

/** One of the screen's own actions: icon and small label; while active the icon turns orange and the name says so. */
export function Action({ icon, label, active, ...target }: Target & { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <Control {...target} className={active ? 'act is-active' : 'act'} label={active ? `${label} (active)` : undefined}>
      {icon}
      <span>{label}</span>
    </Control>
  )
}

/**
 * Dock at the bottom: a 5-column row with the main button in the middle, actions beside it (research
 * R1); a fourth action (`outer`) takes the outer right column (F004: a collection's Show-off).
 */
export function ActionBar({ main, left, right, outer }: { main: ReactNode; left?: ReactNode; right?: ReactNode; outer?: ReactNode }) {
  return (
    <nav className="actionbar" aria-label="Actions">
      {left && <div className="actionbar-left">{left}</div>}
      {main}
      {right && <div className="actionbar-right">{right}</div>}
      {outer && <div className="actionbar-outer">{outer}</div>}
    </nav>
  )
}
