import { type FormEvent, useId, useState } from 'react'

import { parseListLink } from '../../domain/lists.ts'
import { navigate } from '../router.ts'
import { Sheet } from './Sheet.tsx'

/** "Load a BGG list" by its link (FR-012): previews bring booth, price and edition, geeklists only games; opens the list. */
export function LoadListSheet({ onClose }: { onClose: () => void }) {
  const linkId = useId()
  const hintId = useId()
  const [text, setText] = useState('')
  const list = parseListLink(text)
  const hint = !text.trim()
    ? null
    : !list
      ? 'Paste a link to a BoardGameGeek preview or geeklist, like boardgamegeek.com/geekpreview/93.'
      : list.kind === 'preview'
        ? 'Preview: games with booth, price, publisher and edition.'
        : 'Geeklist: games without booth and price.'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (list) navigate({ name: 'list', kind: list.kind, listId: list.id }, { replace: true })
  }

  return (
    <Sheet open title="Load a BGG list" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="lead">Paste the link of a BoardGameGeek preview (like SPIEL Essen 2026, with booth, price and edition) or a geeklist.</p>
        <div>
          <label className="label" htmlFor={linkId}>
            BGG list link
          </label>
          <div className="field">
            <input
              id={linkId}
              inputMode="url"
              autoComplete="off"
              placeholder="boardgamegeek.com/geekpreview/…"
              value={text}
              aria-describedby={hint ? hintId : undefined}
              aria-invalid={hint ? !list : undefined}
              onChange={e => setText(e.target.value)}
            />
          </div>
          {hint && (
            <p className={`hint${list ? '' : ' error'}`} id={hintId}>
              {hint}
            </p>
          )}
        </div>
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!list}>
            Load list
          </button>
        </div>
      </form>
    </Sheet>
  )
}
