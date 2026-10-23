import type { GroupBy } from './FilterPanel.tsx'

/**
 * The quick filters between the collection's two separators (docs/design.md v2.2.0 "Quick filters",
 * "Search in a collection"): the Cat | Booth toggle (the same setting as "Group by"), the 🛒 Buy chip, the
 * number of games shown, and the search field below. The search text is the screen's, not stored.
 */
export function QuickFilters({
  collection,
  groupBy,
  buy,
  count,
  query,
  onGroupBy,
  onBuy,
  onQuery,
}: {
  collection: string
  groupBy: GroupBy
  buy: boolean
  count: number
  query: string
  onGroupBy: (groupBy: GroupBy) => void
  onBuy: () => void
  onQuery: (query: string) => void
}) {
  const byCategory = groupBy === 'mark'
  return (
    <div className="quick" role="group" aria-label="Quick filters">
      <div className="quick-row">
        <button
          type="button"
          className="qtoggle"
          aria-label={byCategory ? 'Grouped by categories; tap to group by booths' : 'Grouped by booths; tap to group by categories'}
          onClick={() => onGroupBy(byCategory ? 'booth' : 'mark')}
        >
          <span className={byCategory ? 'on' : undefined}>Cat</span>
          <span className={byCategory ? undefined : 'on'}>Booth</span>
        </button>
        <button type="button" className="qchip" aria-pressed={buy} onClick={onBuy}>
          🛒 Buy
        </button>
        <span className="quick-count">
          {count} {count === 1 ? 'game' : 'games'}
        </span>
      </div>
      <div className="field quick-search">
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.2-4.2" />
        </svg>
        <input
          type="search"
          aria-label={`Search ${collection}`}
          placeholder="Search this collection"
          autoComplete="off"
          value={query}
          onChange={e => onQuery(e.target.value)}
        />
      </div>
    </div>
  )
}
