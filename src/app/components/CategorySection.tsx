import { useId, useState } from 'react'

import type { Entry } from '../../domain/collection.ts'
import { type Mark, markInfo } from '../../domain/marks.ts'
import { CategoryList, CategoryOptions } from './CategorySheet.tsx'

/**
 * F008 (docs/design.md "Category section"): a folded block in the game sheet of a shopping list. The
 * header shows the current category; unfolded it is the category sheet's list, and a tap sets the
 * category, folds the section and toasts. Replaces the hexagon picker.
 */
export function CategorySection({ entry, name }: { entry: Entry; name: string }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const { emoji, label } = markInfo(entry.mark)
  return (
    <section className="prices-sec cat-sec">
      <button type="button" className="prices-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">🏷️</span>
        Category
        <span className="cat-now">
          <span className="cat-now-hex hex" data-mark={entry.mark} aria-hidden="true" />
          <span aria-hidden="true">{emoji}</span> {label}
        </span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="prices-body" id={bodyId} hidden={!open}>
        {open && <CategoryList entry={entry} name={name} onChosen={() => setOpen(false)} />}
      </div>
    </section>
  )
}

/**
 * F008: the same folded section for a choice that is not saved yet (the category new entries get in
 * the add to shopping lists sheet); a tap picks and folds. Replaces the hexagon picker there.
 */
export function CategoryChoice({ label: title, value, onPick }: { label: string; value: Mark; onPick: (mark: Mark) => void }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const { emoji, label } = markInfo(value)
  return (
    <section className="prices-sec cat-sec">
      <button type="button" className="prices-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">🏷️</span>
        {title}
        <span className="cat-now">
          <span className="cat-now-hex hex" data-mark={value} aria-hidden="true" />
          <span aria-hidden="true">{emoji}</span> {label}
        </span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="prices-body" id={bodyId} hidden={!open}>
        {open && (
          <CategoryOptions
            current={value}
            onPick={(_, mark) => {
              onPick(mark)
              setOpen(false)
            }}
          />
        )}
      </div>
    </section>
  )
}
