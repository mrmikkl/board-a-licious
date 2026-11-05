import { useId } from 'react'

import { type Bought, type Filter, PRESETS, type Price, dropBuy, isDefaultView } from '../../domain/filter.ts'
import { MARKS, type Mark } from '../../domain/marks.ts'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

export type GroupBy = 'mark' | 'booth'

const BOUGHT: { key: Bought; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'no', label: 'Not bought' },
  { key: 'yes', label: '✅ Bought' },
]

const PRICE: { key: Price; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'cheap', label: '≤ €30' },
  { key: 'mid', label: '€30–60' },
  { key: 'expensive', label: '> €60' },
]

/**
 * "Filter and group" (docs/design.md v2.2.0 "Filter and group", F005 R5): a sheet opened from the
 * Filter action, so the collection stays in focus. Bought, Price (listed price), a checkbox per category
 * with Select all / none, and Group by (Categories / Booths). Changes apply at once; any change turns
 * the Buy quick filter off. Clear filters (disabled at the default view) and Done at the bottom.
 */
export function FilterSheet({
  open,
  filter,
  counts,
  groupBy,
  onChange,
  onGroupBy,
  onClear,
  onClose,
}: {
  open: boolean
  filter: Filter
  counts: Record<Mark, number>
  groupBy: GroupBy
  onChange: (filter: Filter) => void
  onGroupBy: (groupBy: GroupBy) => void
  onClear: () => void
  onClose: () => void
}) {
  const toast = useToast()
  const groupById = useId()
  const plain = dropBuy(filter)
  const isDefault = isDefaultView(filter, groupBy)
  const toggleGroup = (mark: Mark) => {
    const groups = new Set(plain.groups)
    if (groups.has(mark)) groups.delete(mark)
    else groups.add(mark)
    onChange({ ...plain, groups })
  }
  const clear = () => {
    onClear()
    toast('Filters cleared')
  }
  return (
    <Sheet open={open} title="Filter and group" onClose={onClose}>
      <div className="filter-panel" role="group" aria-label="Filter">
        <p className="seg-title" aria-hidden="true">
          Bought
        </p>
        <div className="seg" role="group" aria-label="Bought">
          {BOUGHT.map(b => (
            <button key={b.key} type="button" aria-pressed={filter.bought === b.key} onClick={() => onChange({ ...plain, bought: b.key })}>
              {b.label}
            </button>
          ))}
        </div>
        <p className="seg-title" aria-hidden="true">
          Price
        </p>
        <div className="seg" role="group" aria-label="Price">
          {PRICE.map(p => (
            <button key={p.key} type="button" aria-pressed={filter.price === p.key} onClick={() => onChange({ ...plain, price: p.key })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="seg-head">
          <p className="seg-title" aria-hidden="true">
            Categories
          </p>
          <div className="seg-actions">
            <button type="button" className="link-btn" onClick={() => onChange({ ...plain, groups: new Set(MARKS.map(m => m.key)) })}>
              Select all
            </button>
            <button type="button" className="link-btn" onClick={() => onChange({ ...plain, groups: new Set() })}>
              Select none
            </button>
          </div>
        </div>
        <div role="group" aria-label="Categories">
          {MARKS.map(m => (
            <label key={m.key} className="filter-row">
              <input type="checkbox" checked={plain.groups.has(m.key)} onChange={() => toggleGroup(m.key)} />
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
          <option value="mark">Categories</option>
          <option value="booth">Booths</option>
        </select>
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn btn-block" disabled={isDefault} onClick={clear}>
          Clear filters
        </button>
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  )
}
