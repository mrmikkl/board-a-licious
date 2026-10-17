import type { ReactNode } from 'react'

/**
 * Screen header: back button (or logo) and title; on phones a second row holds the screen's badge
 * and buttons (docs/design.md §6). Sound is switched in Config.
 */
export function Header({ title, back, actions }: { title: string; back?: string; actions?: ReactNode }) {
  return (
    <header className="top">
      <div className="top-main">
        {back ? (
          <a className="icon-btn back" href={back} aria-label="Back">
            ‹
          </a>
        ) : (
          <span className="logo hex" aria-hidden="true">
            B
          </span>
        )}
        <h1>{title}</h1>
      </div>
      {actions && <div className="top-tools">{actions}</div>}
    </header>
  )
}
