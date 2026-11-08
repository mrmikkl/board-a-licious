import { useId, useState } from 'react'

import type { Game, StoredListEntry } from '../../client/types.ts'
import type { Collection, Entry } from '../../domain/collection.ts'
import { type Mark, markInfo } from '../../domain/marks.ts'
import { memberships } from '../../domain/membership.ts'
import { useServices, useStoreData } from '../context.tsx'
import { applyMembership } from '../list-actions.ts'
import { href } from '../router.ts'
import { CategoryPicker } from './CategoryPicker.tsx'
import { HexCover } from './HexCover.tsx'
import { yearText } from './ListGameRow.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

/** A game to put into shopping lists: a search result or a BGG list's game, with the facts of its list. */
export type AddItem = Pick<StoredListEntry, 'bggId' | 'name' | 'thumbnailUrl' | 'facts'> & { year?: number | null; kind?: 'boardgame' | 'expansion' }

const plural = (n: number) => `${n} ${n === 1 ? 'shopping list' : 'shopping lists'}`

/** What Done will do to this shopping list, or what the game is there now. */
export function note(entry: Entry | undefined, ticked: boolean) {
  if (entry && ticked) return entry.mark === 'new' ? 'In it, not yet marked' : `In it, marked ${markInfo(entry.mark).label}`
  if (entry) return entry.bought ? 'Will be removed, including its mark and the price you paid' : 'Will be removed, including its mark'
  if (ticked) return 'Will be added'
  return 'Not in it'
}

/** A row of the multi-choice list: hexagon tick, shopping list name and what Done does (docs/design.md §7). */
export function Pick({ collection, checked, note, onChange }: { collection: Collection; checked: boolean; note: string; onChange: (on: boolean) => void }) {
  const nameId = useId()
  const noteId = useId()
  return (
    <label className="pick">
      <input type="checkbox" className="pick-input" checked={checked} aria-labelledby={nameId} aria-describedby={noteId} onChange={e => onChange(e.target.checked)} />
      <span className="tick hex" aria-hidden="true" />
      <span className="pick-text">
        <span className="pick-name">
          <span id={nameId}>{collection.name}</span>
        </span>
        <small id={noteId}>{note}</small>
      </span>
    </label>
  )
}

/**
 * The shopping list choice (docs/design.md "Add to collections sheet"): opened by a list game row's Add,
 * the game sheet's Add to shopping lists and its "in …" line. One tick per shopping list, starting from
 * where the game is now, and the optional category for new ones; nothing changes until Done (FR-014).
 */
export function AddToCollectionsSheet({ item, game, onClose }: { item: AddItem; game?: Game; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const [ticked, setTicked] = useState<Set<string>>()
  const [mark, setMark] = useState<Mark>('new')
  const [busy, setBusy] = useState(false)
  const name = game?.name || item.name
  const data = useStoreData(
    async store => ({
      bggId: item.bggId,
      collections: (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name)),
      entries: (await store.allEntries()).filter(e => e.bggId === item.bggId && !e.deleted),
    }),
    [item.bggId],
  )
  const ready = data?.bggId === item.bggId ? data : undefined
  const before = ready ? memberships(ready.entries, item.bggId) : new Set<string>()
  const after = ticked ?? before
  const changed = before.size !== after.size || [...after].some(id => !before.has(id))

  const toggle = (id: string, on: boolean) => {
    const next = new Set(after)
    if (on) next.add(id)
    else next.delete(id)
    setTicked(next)
  }
  const done = async () => {
    if (!changed) return onClose()
    setBusy(true)
    try {
      // the details already loaded go along, so the rows show them at once
      if (game) await services.store.putGames([game])
      const { added, removed } = await applyMembership(services, { ...item, name, thumbnailUrl: game?.thumbnailUrl ?? item.thumbnailUrl }, before, after, mark)
      onClose()
      toast([added && `Added ${name} to ${plural(added)}`, removed && `Removed it from ${plural(removed)}`].filter(Boolean).join('. '))
    } finally {
      setBusy(false)
    }
  }
  const year = game?.year ?? item.year
  const expansion = (game?.kind ?? item.kind) === 'expansion'

  return (
    <Sheet open title={`Add ${name}`} onClose={onClose}>
      <div className="found">
        <HexCover game={game ?? { ...item, year: null, description: null, kind: 'boardgame' }} name={name} size={48} />
        <span className="row-meta">
          <span className="row-name">{name}</span>
          {(year !== undefined || expansion) && (
            <span className="row-sub">
              {year !== undefined && yearText(year)}
              {expansion && <span className="kind-pill">Expansion</span>}
            </span>
          )}
        </span>
      </div>
      {ready && ready.collections.length === 0 ? (
        <p className="lead">
          You have no shopping list yet. <a href={href({ name: 'collections', create: true })}>Create a shopping list</a>, then come back to this game.
        </p>
      ) : (
        <>
          <p className="lead">Tick every shopping list this game should be in, then press Done.</p>
          <div className="picks">
            {ready?.collections.map(c => (
              <Pick
                key={c.id}
                collection={c}
                checked={after.has(c.id)}
                note={note(
                  ready.entries.find(e => e.collectionId === c.id),
                  after.has(c.id),
                )}
                onChange={on => toggle(c.id, on)}
              />
            ))}
          </div>
          <p className="label">Category when added (optional)</p>
          <CategoryPicker value={mark} onPick={key => setMark(m => (m === key ? 'new' : key))} />
        </>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-block" disabled={!ready || busy} onClick={() => void done()}>
          Done
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
