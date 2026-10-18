import { useEffect, useId, useRef, useState } from 'react'

import { type Bought, type Filter, type Price, filterLabel } from '../../domain/filter.ts'
import { MARKS, type Mark } from '../../domain/marks.ts'

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
 * One full-width button showing the selection and the number of games shown; it opens a panel with
 * a Bought segment, a Price segment (listed price: cheap up to 30, mid up to 60, expensive above) and
 * a checkbox per group with Select all / Select none (docs/design.md §7, FR-009). Closes on Done,
 * Esc or a tap outside.
 */
export function FilterPanel({ filter, shown, counts, onChange }: { filter: Filter; shown: number; counts: Record<Mark, number>; onChange: (filter: Filter) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggleGroup = (mark: Mark) => {
    const groups = new Set(filter.groups)
    if (groups.has(mark)) groups.delete(mark)
    else groups.add(mark)
    onChange({ ...filter, groups })
  }
  const done = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div className="filter" ref={ref}>
      <button type="button" className="filter-btn" ref={buttonRef} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(o => !o)}>
        <span className="filter-ico hex" aria-hidden="true" />
        <span className="visually-hidden">Filter: </span>
        <span className="filter-label">{filterLabel(filter)}</span>
        <b className="filter-count">{shown}</b>
        <span className="visually-hidden"> shown</span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      {open && (
        <div className="filter-panel" id={panelId} role="group" aria-label="Filter">
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
          <button type="button" className="btn btn-primary btn-block" onClick={done}>
            Done
          </button>
        </div>
      )}
    </div>
  )
}
