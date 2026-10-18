import { type FormEvent, useState } from 'react'

import type { Collection } from '../../domain/collection.ts'
import { addGameByLink } from '../actions.ts'
import { useServices } from '../context.tsx'
import { type LinkState, GameLinkFields, emptyLink } from './GameLinkFields.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

/** "Add game" (FR-016): one game by its BoardGameGeek link, for games that are not on a list. */
export function AddGameSheet({ collection, inside, onClose }: { collection: Collection; inside: Set<number>; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const [link, setLink] = useState<LinkState>(emptyLink)
  const [busy, setBusy] = useState(false)
  const parsed = link.parsed?.ok ? link.parsed : null
  const already = Boolean(parsed && inside.has(parsed.bggId))
  const ready = Boolean(parsed && link.name.trim() && !already && !busy)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !parsed) return
    setBusy(true)
    try {
      await addGameByLink(services, collection.id, parsed.bggId, link.name)
      toast(`Added ${link.name.trim()} to ${collection.name}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open title="Add game" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="lead">For a game that is not on any of your lists: paste its link from boardgamegeek.com.</p>
        <GameLinkFields state={link} onChange={setLink} />
        {already && <p className="hint error">This game is already in {collection.name}.</p>}
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            Add to collection
          </button>
        </div>
      </form>
    </Sheet>
  )
}
