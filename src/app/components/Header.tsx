import type { ReactNode } from 'react'

/**
 * Screen header in one row (docs/design.md §6): back button (or logo), the title with its badge
 * (e.g. Essen) directly below it like a subheading, and the screen's buttons (e.g. ⋯) at the far
 * right. Sound is switched in Config.
 */
export function Header({ title, back, badge, actions }: { title: string; back?: string; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="top">
      {back ? (
        <a className="icon-btn back" href={back} aria-label="Back">
          ‹
        </a>
      ) : (
        <span className="logo hex" aria-hidden="true">
          B
        </span>
      )}
      <div className="top-title">
        <h1>{title}</h1>
        {badge && <div className="top-badge">{badge}</div>}
      </div>
      {actions && <div className="top-actions">{actions}</div>}
    </header>
  )
}
