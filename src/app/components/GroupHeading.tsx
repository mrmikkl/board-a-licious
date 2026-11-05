import { Counter } from './Counter.tsx'

/**
 * A group in a collection (docs/design.md v2.2.0 "Group heading"): a small coloured hexagon, the label
 * with its emoji, and a rolling count. The whole heading is the button that folds the group; the count
 * stays visible while folded.
 */
export function GroupHeading({
  id,
  group,
  count,
  open,
  onToggle,
}: {
  id: string
  group: { key: string; label: string; emoji?: string }
  count: number
  open: boolean
  onToggle: () => void
}) {
  return (
    <h2 id={id} className="group-title" data-mark={group.key}>
      <button type="button" className="fold" aria-expanded={open} onClick={onToggle}>
        <i className="hex" aria-hidden="true" />
        <span>{group.emoji ? `${group.emoji} ${group.label}` : group.label}</span>
        <b className="group-count">
          <Counter value={count} />
        </b>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
    </h2>
  )
}
