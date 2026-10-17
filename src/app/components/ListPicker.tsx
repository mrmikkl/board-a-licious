import { type FormEvent, useId, useState } from 'react'

import type { StoredList } from '../../client/types.ts'
import type { Collection, Entry } from '../../domain/collection.ts'
import { factsRule } from '../../domain/facts.ts'
import { type ListRef, parseListLink } from '../../domain/lists.ts'
import { swipeQueue } from '../../domain/swipe.ts'
import { EssenBadge } from './EssenBadge.tsx'
import { Sheet } from './Sheet.tsx'

const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`

/** "Add from which list?": one of the lists on this device, or a link to load one (FR-012, FR-015). */
export function ListPicker({
  collection,
  entries,
  lists,
  error,
  onPick,
  onClose,
}: {
  collection: Collection
  entries: Entry[]
  lists: StoredList[]
  error?: string
  onPick: (ref: ListRef) => void
  onClose: () => void
}) {
  const linkId = useId()
  const hintId = useId()
  const [link, setLink] = useState('')
  const ref = parseListLink(link)
  const wrong = link.trim().length > 0 && !ref

  const load = (event: FormEvent) => {
    event.preventDefault()
    if (ref) onPick(ref)
  }

  return (
    <Sheet open title="Add from which list?" onClose={onClose}>
      {lists.length > 0 && (
        <ul className="pick-list">
          {lists.map(list => {
            const queue = swipeQueue(list, entries)
            const left = queue.games.length
            const text = queue.allDecided
              ? "You've seen every game on it"
              : `${left > 0 ? `${games(left)} to go through` : 'More games are loading'}. ${factsRule(list.isEssen, collection.type).reason}.`
            return (
              <li key={`${list.kind}:${list.id}`}>
                <button type="button" className="pick" disabled={queue.allDecided} onClick={() => onPick({ kind: list.kind, id: list.id })}>
                  <span className="pick-title">
                    {list.title} {list.isEssen && <EssenBadge />}
                  </span>
                  <small>{text}</small>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form className="form" onSubmit={load}>
        <div>
          <label className="label" htmlFor={linkId}>
            {lists.length > 0 ? 'Or load another BGG list link' : 'BGG list link'}
          </label>
          <div className="field">
            <input
              id={linkId}
              value={link}
              inputMode="url"
              autoComplete="off"
              placeholder="boardgamegeek.com/geekpreview/…"
              aria-describedby={hintId}
              aria-invalid={wrong || Boolean(error)}
              onChange={e => setLink(e.target.value)}
            />
          </div>
          <p id={hintId} className={`hint${wrong || error ? ' error' : ''}`}>
            {wrong ? 'Paste the link of a BGG preview or geeklist.' : (error ?? 'A BoardGameGeek preview or geeklist; previews bring booth and price.')}
          </p>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={!ref}>
          Load list
        </button>
      </form>
      <div className="sheet-actions">
        <button type="button" className="btn btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
