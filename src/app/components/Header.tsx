import type { MouseEvent, ReactNode } from 'react'

/**
 * The screen heading below the app bar (docs/design.md §6 "Screen heading"): a back button only on
 * screens reached from another screen's content, the title, and an optional element right after it
 * (e.g. the collection's pencil).
 */
export function Header({
  title,
  back,
  trailing,
  onTitleClick,
}: {
  title: string
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
      <div className="top-title">
        <h1 className={onTitleClick ? 'tappable' : undefined} onClick={onTitleClick}>
          {title}
        </h1>
      </div>
      {trailing && <div className="top-actions">{trailing}</div>}
    </div>
  )
}
