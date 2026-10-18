import type { MouseEvent, ReactNode } from 'react'

/**
 * Screen header in one row (docs/design.md §6): back button (or logo), the title with its badge
 * (e.g. Essen) directly below it like a subheading, and the screen's buttons (e.g. ⋯) at the far
 * right. Sound is switched in Config.
 */
export function Header({
  title,
  back,
  badge,
  actions,
  onTitleClick,
  lead = true,
}: {
  title: string
  back?: string
  badge?: ReactNode
  actions?: ReactNode
  onTitleClick?: (event: MouseEvent) => void
  /** false: no back button and no logo, the title gets the whole width */
  lead?: boolean
}) {
  return (
    <header className="top">
      {!lead ? null : back ? (
        <a className="icon-btn back" href={back} aria-label="Back">
          ‹
        </a>
      ) : (
        <span className="logo hex" aria-hidden="true">
          B
        </span>
      )}
      <div className="top-title">
        <h1 className={onTitleClick ? 'tappable' : undefined} onClick={onTitleClick}>{title}</h1>
        {badge && <div className="top-badge">{badge}</div>}
      </div>
      {actions && <div className="top-actions">{actions}</div>}
    </header>
  )
}
