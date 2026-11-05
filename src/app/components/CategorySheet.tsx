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
 * "Category of <game>" (docs/design.md v2.2.0 "Category sheet", F005 R4): the categories as a list; a tap
 * sets it, closes the sheet and toasts "<game> → <emoji> <label>". Opened from a row's Category action.
 */
export function CategorySheet({ entry, name, onClose }: { entry: Entry; name: string; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const choose = async (event: MouseEvent<HTMLButtonElement>, mark: Mark) => {
    const from = centreOf(event.currentTarget)
    await setMark(services, entry, mark, from)
    onClose()
    const { emoji, label } = markInfo(mark)
    toast(`${name} → ${emoji} ${label}`)
  }
  const option = (mark: Mark) => {
    const { emoji, label } = markInfo(mark)
    const current = entry.mark === mark
    return (
      <button key={mark} type="button" className="cat-option" aria-pressed={current} onClick={e => void choose(e, mark)}>
        <span className="cat-hex" data-mark={mark}>
          {emoji}
        </span>
        <span className="cat-name">{label}</span>
        {current && <small>current</small>}
      </button>
    )
  }
  return (
    <Sheet open title={`Category of ${name}`} onClose={onClose}>
      <div className="cat-list">
        {MARKED.map(m => option(m.key))}
        <hr className="cat-rule" />
        {REST.map(m => option(m.key))}
      </div>
    </Sheet>
  )
}
