import { useEffect, useId, useRef, useState } from 'react'

import { type Bought, type Filter, PRESETS, filterLabel, presetOf } from '../../domain/filter.ts'
import { MARKS, type Mark } from '../../domain/marks.ts'

const BOUGHT: { key: Bought; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'no', label: 'Not bought' },
  { key: 'yes', label: '✅ Bought' },
]

/**
 * One full-width button showing the selection and the number of games shown; it opens a panel with
 * presets, a Bought segment and a checkbox per group (docs/design.md §7, FR-009). Closes on Done,
 * Esc or a tap outside.
 */
export function FilterPanel({ filter, shown, counts, onChange }: { filter: Filter; shown: number; counts: Record<Mark, number>; onChange: (filter: Filter) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const preset = presetOf(filter)

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
          <div className="filter-presets" role="group" aria-label="Presets">
            <button type="button" className="chip" aria-pressed={preset === 'all'} onClick={() => onChange(PRESETS.all)}>
              All
            </button>
            <button type="button" className="chip" aria-pressed={preset === 'hunt'} onClick={() => onChange(PRESETS.hunt)}>
              ⭐ Must Have, not bought
            </button>
          </div>
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
            Groups
          </p>
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
