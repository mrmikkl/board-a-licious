import type { MarkInfo } from '../../domain/marks.ts'

/** Small coloured hexagon, label and count; "Not interested" folds with a chevron (docs/design.md §7). */
export function GroupHeading({ id, mark, count, open, onToggle }: { id: string; mark: MarkInfo; count: number; open?: boolean; onToggle?: () => void }) {
  const content = (
    <>
      <i className="hex" aria-hidden="true" />
      <span>{mark.label}</span>
      <b className="group-count">{count}</b>
    </>
  )
  return (
    <h2 id={id} className="group-title" data-mark={mark.key}>
      {onToggle ? (
        <button type="button" className="fold" aria-expanded={open} onClick={onToggle}>
          {content}
          <span className="chev" aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        content
      )}
    </h2>
  )
}
