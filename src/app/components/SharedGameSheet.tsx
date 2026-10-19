import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'

import { type Collection, type Entry, NAME_MAX } from '../../domain/collection.ts'
import { addGameByLink, createCollection } from '../actions.ts'
import { useServices, useStoreData } from '../context.tsx'
import { markJustAdded } from '../just-added.ts'
import { navigate } from '../router.ts'
import { HexCover } from './HexCover.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

/**
 * F002 "Shared game" sheet (docs/design.md v1.9.0, specs/002-share-from-bgg/design.md).
 * On add it calls addGameByLink, stores meta lastShareCollection, marks the row with
 * markJustAdded (../just-added.ts), shows the toast and navigates (replace) to the collection.
 */
export type SharedGameSheetProps = {
  bggId: number
  suggestedName: string
  /** live collections of the person, sorted by name; empty → the "Create and add" variant */
  collections: Collection[]
  /** live entries of all collections (for "(already in it)") */
  entries: Entry[]
  /** collection to preselect (lastShareCollection if it still exists, else the first) */
  preselected?: string
  /** Cancel / scrim / Esc: nothing added */
  onClose: () => void
}

export function SharedGameSheet({ bggId, suggestedName, collections, entries, preselected, onClose }: SharedGameSheetProps) {
  // a stable callback: the Sheet re-runs its open effect (and moves focus) whenever onClose changes
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const close = useCallback(() => closeRef.current(), [])
  const services = useServices()
  const toast = useToast()
  const game = useStoreData(store => store.game(bggId), [bggId])
  const online = useOnline()
  const [name, setName] = useState(suggestedName)
  // until the person picks one, the preselection (which may arrive after the first sync) counts
  const [chosen, setChosen] = useState<string>()
  const [newName, setNewName] = useState('SPIEL 2026')
  const [busy, setBusy] = useState(false)
  const nameId = useId()
  const selectId = useId()
  const hintId = useId()
  const newNameId = useId()

  const gameName = name.trim() || suggestedName
  const inside = new Set(entries.filter(e => e.bggId === bggId && !e.deleted).map(e => e.collectionId))
  const collection = collections.find(c => c.id === (chosen ?? preselected)) ?? collections[0]
  const already = Boolean(collection && inside.has(collection.id))
  const creating = collections.length === 0
  const validNew = newName.trim().length > 0 && newName.trim().length <= NAME_MAX
  const ready = !busy && (creating ? validNew : Boolean(collection) && !already)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    setBusy(true)
    try {
      const target = creating ? await createCollection(services, newName) : collection!
      await addGameByLink(services, target.id, bggId, gameName)
      await services.store.setMeta('lastShareCollection', target.id)
      markJustAdded(target.id, bggId)
      toast(`Added ${gameName} to ${target.name.trim()}`)
      navigate({ name: 'collection', id: target.id }, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open title="Add game" onClose={close}>
      <form className="form" onSubmit={submit}>
        <div className="shared-game">
          <HexCover game={game} name={gameName} size={64} />
          <div>
            {creating ? (
              <b>{gameName}</b>
            ) : (
              <>
                <label className="label" htmlFor={nameId}>
                  Name
                </label>
                <div className="field">
                  <input id={nameId} value={name} autoComplete="off" onChange={e => setName(e.target.value)} />
                </div>
              </>
            )}
            <small className="muted">Shared from BoardGameGeek</small>
          </div>
        </div>
        {!online && (
          <p className="hint shared-offline" role="status">
            You are offline: the game is added on this phone now; its cover and details follow once you are back online.
          </p>
        )}
        {creating ? (
          <>
            <p className="lead">A game goes into a collection, and you have none yet. Create one, and {gameName} goes straight into it.</p>
            <div>
              <label className="label" htmlFor={newNameId}>
                Collection name
              </label>
              <div className="field">
                <input id={newNameId} value={newName} maxLength={NAME_MAX} autoComplete="off" onChange={e => setNewName(e.target.value)} />
              </div>
            </div>
          </>
        ) : (
          <div>
            <label className="label" htmlFor={selectId}>
              Collection
            </label>
            <div className="field select">
              <select id={selectId} value={collection?.id} aria-describedby={hintId} onChange={e => setChosen(e.target.value)}>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {inside.has(c.id) ? ' (already in it)' : c.id === preselected ? ' (last used)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {/* one hint line, updated in place: the sheet does not slide up again */}
            <p className={`hint${already ? ' error' : ''}`} id={hintId}>
              {already && collection
                ? `${gameName} is already in ${collection.name}. Pick another collection.`
                : collection?.id === preselected
                  ? 'Preselected: the collection you last shared into.'
                  : ''}
            </p>
          </div>
        )}
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            {creating ? 'Create and add' : 'Add to collection'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/** navigator.onLine, kept up to date by the online/offline events. */
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
