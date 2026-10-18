import { type FormEvent, useId, useState } from 'react'

import type { StoredList } from '../../client/types.ts'
import type { Collection, Entry } from '../../domain/collection.ts'
import { factsRule } from '../../domain/facts.ts'
import { type ListRef, parseListLink } from '../../domain/lists.ts'
import { swipeQueue } from '../../domain/swipe.ts'
import { EssenBadge } from './EssenBadge.tsx'
import { Sheet } from './Sheet.tsx'

const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`

type Mode = 'select' | 'new'

/**
 * "Add by list" (FR-012, FR-015): a sheet over the collection with two ways in, chosen in a button
 * group: "Select list" (one of the lists loaded, highlighted when chosen; Select) or "Add new list"
 * (paste a BGG list link; Load list). Either leads to swiping that list.
 */
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
  const [mode, setMode] = useState<Mode>(lists.length > 0 && !error ? 'select' : 'new')
  const [selected, setSelected] = useState<ListRef | null>(null)
  const [link, setLink] = useState('')
  const ref = parseListLink(link)
  const wrong = link.trim().length > 0 && !ref

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const choice = mode === 'select' ? selected : ref
    if (choice) onPick(choice)
  }

  return (
    <Sheet open title="Add by list" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="lead pick-intro">
          Go through a list game by game, Tinder style: swipe right to add a game to {collection.name}, swipe left to pass on it. Games you've
          decided on don't come back.
        </p>
        <div className="seg" role="group" aria-label="Which list">
          <button type="button" aria-pressed={mode === 'select'} onClick={() => setMode('select')}>
            Select list
          </button>
          <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>
            Add new list
          </button>
        </div>

        {mode === 'select' ? (
          lists.length === 0 ? (
            <p className="lead pick-empty">No lists yet. Load one with "Add new list".</p>
          ) : (
            <ul className="pick-list" aria-label="Your lists">
              {lists.map(list => {
                const queue = swipeQueue(list, entries)
                const left = queue.games.length
                const isChosen = selected?.kind === list.kind && selected.id === list.id
                const text = queue.allDecided
                  ? "You've seen every game on it"
                  : `${left > 0 ? `${games(left)} to go through` : 'More games are loading'}. ${factsRule(list.isEssen, collection.type).reason}.`
                return (
                  <li key={`${list.kind}:${list.id}`}>
                    <button
                      type="button"
                      className="pick"
                      aria-pressed={isChosen}
                      disabled={queue.allDecided}
                      onClick={() => setSelected({ kind: list.kind, id: list.id })}
                    >
                      <span className="pick-title">
                        {list.title} {list.isEssen && <EssenBadge />}
                      </span>
                      <small>{text}</small>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <div className="pick-new">
            <label className="label" htmlFor={linkId}>
              BGG list link
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
        )}

        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={mode === 'select' ? !selected : !ref}>
            {mode === 'select' ? 'Select' : 'Load list'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
