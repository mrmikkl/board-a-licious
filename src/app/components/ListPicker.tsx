import { type FormEvent, useId, useState } from 'react'

import type { StoredList } from '../../client/types.ts'
import { STATUS_KEYS, STATUS_NAMES, counts } from '../../domain/bgg-status.ts'
import type { Collection, Entry } from '../../domain/collection.ts'
import { parseListLink, suggestSpielPreview } from '../../domain/lists.ts'
import { statusSwipeList, swipeQueue } from '../../domain/swipe.ts'
import { useStoreData } from '../context.tsx'
import type { SwipeSource } from '../router.ts'
import { ListSuggestion } from './ListSuggestion.tsx'
import { Sheet } from './Sheet.tsx'

const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`

type Mode = 'select' | 'new'

/** F008: the status lists with games of the person (first) and of the friends loaded by link, from the device. */
function useStatusChoices() {
  return useStoreData(async store => {
    const username = (await store.bggUsername())?.toLowerCase()
    const users = [...(username ? [username] : []), ...(await store.follows()).filter(f => f !== username)]
    const choices: { source: SwipeSource & { kind: 'status' }; title: string; sub: string; games: ReturnType<typeof statusSwipeList> }[] = []
    for (const bggUser of users) {
      const collection = await store.bggCollection(bggUser)
      if (!collection?.loadedAt || collection.error) continue
      const found = counts(collection.items)
      for (const status of STATUS_KEYS.filter(key => found[key] > 0)) {
        const own = bggUser === username
        choices.push({
          source: { kind: 'status', bggUser, status },
          title: own ? STATUS_NAMES[status] : `${bggUser}: ${STATUS_NAMES[status]}`,
          sub: own ? `${bggUser} on BoardGameGeek` : 'read-only',
          games: statusSwipeList(collection.items, status),
        })
      }
    }
    return choices
  })
}

const keyOf = (source: SwipeSource) => (source.kind === 'status' ? `status:${source.bggUser}:${source.status}` : `${source.kind}:${source.id}`)

/**
 * "❤️ BG-Tinder ❤️" (FR-012, FR-015; was "Add by list"), opened by the collection's main ♥: a sheet over the collection with two ways in, chosen in a button
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
  onPick: (ref: SwipeSource) => void
  onClose: () => void
}) {
  const linkId = useId()
  const hintId = useId()
  const statusChoices = useStatusChoices() ?? []
  // Select list first when there is something to select (F008: status lists count too)
  const [chosenMode, setMode] = useState<Mode>()
  const mode: Mode = chosenMode ?? ((lists.length > 0 || statusChoices.length > 0) && !error ? 'select' : 'new')
  const [selected, setSelected] = useState<SwipeSource | null>(null)
  const [link, setLink] = useState('')
  const ref = parseListLink(link)
  const wrong = link.trim().length > 0 && !ref

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const choice = mode === 'select' ? selected : ref
    if (choice) onPick(choice)
  }

  return (
    <Sheet open title="❤️ BG-Tinder ❤️" onClose={onClose}>
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
          lists.length === 0 && statusChoices.length === 0 ? (
            <p className="lead pick-empty">No lists yet. Load one with "Add new list".</p>
          ) : (
            <ul className="pick-list" aria-label="Your lists">
              {lists.map(list => {
                const queue = swipeQueue(list, entries)
                const left = queue.games.length
                const isChosen = selected !== null && keyOf(selected) === keyOf(list)
                const text = queue.allDecided
                  ? "You've seen every game on it"
                  : list.pageCount === 0
                    ? 'Its games load when you select it.'
                    : `${left > 0 ? `${games(left)} to go through` : 'More games are loading'}.`
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
                        {list.title}
                      </span>
                      <small>{text}</small>
                    </button>
                  </li>
                )
              })}
              {statusChoices.map(choice => {
                const queue = swipeQueue(choice.games, entries)
                const left = queue.games.length
                const isChosen = selected !== null && keyOf(selected) === keyOf(choice.source)
                return (
                  <li key={keyOf(choice.source)}>
                    <button type="button" className="pick" aria-pressed={isChosen} disabled={queue.allDecided} onClick={() => setSelected(choice.source)}>
                      <span className="pick-title">{choice.title}</span>
                      <small>{queue.allDecided ? "You've seen every game on it" : `${choice.sub} · ${games(left)} to go through.`}</small>
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <div className="pick-new">
            {suggestSpielPreview(lists) && !link && <ListSuggestion onPick={setLink} />}
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
