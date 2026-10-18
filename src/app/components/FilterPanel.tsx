import { useId } from 'react'

import { type Bought, type Filter, type Price } from '../../domain/filter.ts'
import { MARKS, type Mark } from '../../domain/marks.ts'
import { Sheet } from './Sheet.tsx'

export type GroupBy = 'mark' | 'booth'

const BOUGHT: { key: Bought; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'no', label: 'Not bought' },
  { key: 'yes', label: '✅ Bought' },
]

const PRICE: { key: Price; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cheap', label: 'Cheap' },
  { key: 'mid', label: 'Mid' },
  { key: 'expensive', label: 'Expensive' },
]

/**
 * "Filter and group" (docs/design.md §7, FR-009, FR-009a): a sheet opened from the filter icon, so
 * the collection itself stays in focus. Filter: Bought, Price (listed price: cheap up to 30, mid up
 * to 60, expensive above) and a checkbox per group with Select all / Select none. Group by: marks or
 * fair hall. Every change applies at once; Done closes.
 */
export function FilterSheet({
  open,
  filter,
  counts,
  groupBy,
  onChange,
  onGroupBy,
  onClose,
}: {
  open: boolean
  filter: Filter
  counts: Record<Mark, number>
  groupBy: GroupBy
  onChange: (filter: Filter) => void
  onGroupBy: (groupBy: GroupBy) => void
  onClose: () => void
}) {
  const groupById = useId()
  const toggleGroup = (mark: Mark) => {
    const groups = new Set(filter.groups)
    if (groups.has(mark)) groups.delete(mark)
    else groups.add(mark)
    onChange({ ...filter, groups })
  }
  return (
    <Sheet open={open} title="Filter and group" onClose={onClose}>
      <div className="filter-panel" role="group" aria-label="Filter">
        <h3 className="section-title">Filter</h3>
        <p className="seg-title" aria-hidden="true">
          Bought
        </p>
        <div className="seg" role="group" aria-label="Bought">
          {BOUGHT.map(b => (
            <button key={b.key} type="button" aria-pressed={filter.bought === b.key} onClick={() => onChange({ ...filter, bought: b.key })}>
              {b.label}
            </button>
          ))}
        </div>
        <p className="seg-title" aria-hidden="true">
          Price
        </p>
        <div className="seg" role="group" aria-label="Price">
          {PRICE.map(p => (
            <button key={p.key} type="button" aria-pressed={filter.price === p.key} onClick={() => onChange({ ...filter, price: p.key })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="seg-head">
          <p className="seg-title" aria-hidden="true">
            Groups
          </p>
          <div className="seg-actions">
            <button type="button" className="link-btn" onClick={() => onChange({ ...filter, groups: new Set(MARKS.map(m => m.key)) })}>
              Select all
            </button>
            <button type="button" className="link-btn" onClick={() => onChange({ ...filter, groups: new Set() })}>
              Select none
            </button>
          </div>
        </div>
        <div role="group" aria-label="Groups">
          {MARKS.map(m => (
            <label key={m.key} className="filter-row">
              <input type="checkbox" checked={filter.groups.has(m.key)} onChange={() => toggleGroup(m.key)} />
              <span>
                <span aria-hidden="true">{m.emoji}</span> {m.label}
              </span>
              <small>{counts[m.key]}</small>
            </label>
          ))}
        </div>
      </div>
      <hr className="separator" />
      <h3 className="section-title">
        <label htmlFor={groupById}>Group by</label>
      </h3>
      <div className="field select">
        <select id={groupById} value={groupBy} onChange={e => onGroupBy(e.target.value as GroupBy)}>
          <option value="mark">Marks</option>
          <option value="booth">Booth (hall)</option>
        </select>
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  )
}
