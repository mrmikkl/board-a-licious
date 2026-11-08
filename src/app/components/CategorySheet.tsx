import type { MouseEvent } from 'react'

import type { Entry } from '../../domain/collection.ts'
import { MARKS, type Mark, markInfo } from '../../domain/marks.ts'
import { setMark } from '../actions.ts'
import { centreOf } from '../celebrate.ts'
import { useServices } from '../context.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

/** The categories a game can be put in from a row, in the order of docs/design.md §4: the marked ones, then the rest. */
const MARKED = MARKS.filter(m => m.key !== 'new' && m.key !== 'skip')
const REST = MARKS.filter(m => m.key === 'new' || m.key === 'skip')

/**
 * The categories as a list (docs/design.md "Category sheet"): the marked ones, a thin line, then No
 * category yet and Not interested; the current one is marked. A tap sets it and toasts
 * "<game> → <emoji> <label>"; `onChosen` follows (the sheet closes, the Category section folds).
 */
export function CategoryList({ entry, name, onChosen }: { entry: Entry; name: string; onChosen: () => void }) {
  const services = useServices()
  const toast = useToast()
  const choose = async (event: MouseEvent<HTMLButtonElement>, mark: Mark) => {
    const from = centreOf(event.currentTarget)
    await setMark(services, entry, mark, from)
    onChosen()
    const { emoji, label } = markInfo(mark)
    toast(`${name} → ${emoji} ${label}`)
  }
  return <CategoryOptions current={entry.mark} onPick={(event, mark) => void choose(event, mark)} />
}

/** The category options without an entry behind them: `current` is marked, a tap calls `onPick`. */
export function CategoryOptions({ current, onPick }: { current: Mark; onPick: (event: MouseEvent<HTMLButtonElement>, mark: Mark) => void }) {
  const option = (mark: Mark) => {
    const { emoji, label } = markInfo(mark)
    const isCurrent = current === mark
    return (
      <button key={mark} type="button" className="cat-option" aria-pressed={isCurrent} onClick={e => onPick(e, mark)}>
        <span className="cat-hex" data-mark={mark}>
          {emoji}
        </span>
        <span className="cat-name">{label}</span>
        {isCurrent && <small>current</small>}
      </button>
    )
  }
  return (
    <div className="cat-list">
      {MARKED.map(m => option(m.key))}
      <hr className="cat-rule" />
      {REST.map(m => option(m.key))}
    </div>
  )
}

/** "Category of <game>" (F005 R4), opened from a row's Category action: the list; a tap closes the sheet. */
export function CategorySheet({ entry, name, onClose }: { entry: Entry; name: string; onClose: () => void }) {
  return (
    <Sheet open title={`Category of ${name}`} onClose={onClose}>
      <CategoryList entry={entry} name={name} onChosen={onClose} />
    </Sheet>
  )
}
