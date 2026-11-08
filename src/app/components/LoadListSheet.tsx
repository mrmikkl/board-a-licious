import { type FormEvent, useId, useState } from 'react'

import { parseBggCollectionLink } from '../../domain/bgg-link.ts'
import { STATUS_NAMES } from '../../domain/bgg-status.ts'
import { type ListRef, parseListLink, suggestSpielPreview } from '../../domain/lists.ts'
import { useServices, useStoreData } from '../context.tsx'
import { navigate } from '../router.ts'
import { ListSuggestion } from './ListSuggestion.tsx'
import { Sheet } from './Sheet.tsx'

/**
 * "Load a BGG list" by its link (FR-012): previews bring booth, price and edition, geeklists only games; opens the list.
 * F008 (FR-007): a link to someone's BGG collection follows that person (synced) and opens their status
 * list; the person's own collection is in Status lists already and is never followed.
 */
export function LoadListSheet({ lists, onClose }: { lists: ListRef[]; onClose: () => void }) {
  const services = useServices()
  const linkId = useId()
  const hintId = useId()
  const [text, setText] = useState('')
  const username = useStoreData(store => store.bggUsername())
  const list = parseListLink(text)
  const collection = list ? null : parseBggCollectionLink(text)
  const own = Boolean(collection && username && collection.bggUser === username.toLowerCase())
  const valid = Boolean(list || collection)
  const hint = !text.trim()
    ? null
    : list
      ? list.kind === 'preview'
        ? 'Preview: games with booth, price, publisher and edition.'
        : 'Geeklist: games without booth and price.'
      : collection
        ? own
          ? 'Your own BGG collection: it is in Status lists already.'
          : `BGG collection of ${collection.bggUser}${collection.status ? `: ${STATUS_NAMES[collection.status]}` : ''}, read-only.`
        : 'Paste a link to a BoardGameGeek preview or geeklist, like boardgamegeek.com/geekpreview/93.'

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (list) return navigate({ name: 'list', kind: list.kind, listId: list.id }, { replace: true })
    if (!collection) return
    if (!own) {
      await services.store.follow(collection.bggUser)
      void services.sync.schedule()
    }
    const bggUser = own ? username!.toLowerCase() : collection.bggUser
    navigate(collection.status ? { name: 'status-list', bggUser, status: collection.status } : { name: 'lists', tab: 'status' }, { replace: true })
  }

  return (
    <Sheet open title="Load a BGG list" onClose={onClose}>
      <form className="form" onSubmit={e => void submit(e)}>
        <p className="lead">
          Paste the link of a BoardGameGeek preview (like SPIEL Essen 2026, with booth, price and edition), a geeklist, or a friend&apos;s BGG collection.
        </p>
        <div>
          {suggestSpielPreview(lists) && !text && <ListSuggestion onPick={setText} />}
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
              aria-invalid={hint ? !valid : undefined}
              onChange={e => setText(e.target.value)}
            />
          </div>
          {hint && (
            <p className={`hint${valid ? '' : ' error'}`} id={hintId}>
              {hint}
            </p>
          )}
        </div>
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Load list
          </button>
        </div>
      </form>
    </Sheet>
  )
}
