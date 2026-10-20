import type { MouseEvent, ReactNode } from 'react'

/**
 * The screen heading below the app bar (docs/design.md §6 "Screen heading"): a back button only on
 * screens reached from another screen's content, the title, and an optional element right after it
 * (e.g. the collection's pencil). `heading` replaces the default `h1` (the collection's Ticker).
 */
export function Header({
  title,
  heading,
  back,
  trailing,
  onTitleClick,
}: {
  title: string
  heading?: ReactNode
  back?: string
  trailing?: ReactNode
  onTitleClick?: (event: MouseEvent) => void
}) {
  return (
    <div className="top">
      {back && (
        <a className="icon-btn back" href={back} aria-label="Back">
          ‹
        </a>
      )}
      {heading ?? (
        <div className="top-title">
          <h1 className={onTitleClick ? 'tappable' : undefined} onClick={onTitleClick}>
            {title}
          </h1>
        </div>
      )}
      {trailing && <div className="top-actions">{trailing}</div>}
    </div>
  )
}
