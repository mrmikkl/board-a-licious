import { useId, useState } from 'react'

import type { StoredList, StoredListEntry } from '../../client/types.ts'
import { gameUrl } from '../../domain/bgg-link.ts'
import type { Collection, Entry } from '../../domain/collection.ts'
import { factsRule } from '../../domain/facts.ts'
import { markInfo } from '../../domain/marks.ts'
import { memberships } from '../../domain/membership.ts'
import { useServices, useStoreData } from '../context.tsx'
import { applyMembership } from '../list-actions.ts'
import { href } from '../router.ts'
import { EssenBadge } from './EssenBadge.tsx'
import { FactsList } from './ListFacts.tsx'
import { HexCover } from './HexCover.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

const plural = (n: number) => `${n} ${n === 1 ? 'collection' : 'collections'}`

/** What Done will do to this collection, or what the game is there now. */
function note(collection: Collection, entry: Entry | undefined, ticked: boolean, listIsEssen: boolean) {
  if (entry && ticked) return entry.mark === 'new' ? 'In it, not yet marked' : `In it, marked ${markInfo(entry.mark).label}`
  if (entry) return entry.bought ? 'Will be removed, including its mark and the price you paid' : 'Will be removed, including its mark'
  if (ticked) return `Will be added. ${factsRule(listIsEssen, collection.type).reason}`
  return 'Not in it'
}

/**
 * A game in a BGG list (FR-013, FR-014): cover, description, facts and one hexagon tick per
 * collection, starting from where the game is now. Ticks change nothing until Done; Cancel discards.
 */
export function MembershipSheet({ list, item, onClose }: { list: StoredList; item: StoredListEntry; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const [ticked, setTicked] = useState<Set<string>>()
  const [busy, setBusy] = useState(false)
  const data = useStoreData(
    async store => {
      const collections = (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name))
      const entries = (await store.allEntries()).filter(e => e.bggId === item.bggId && !e.deleted)
      return { bggId: item.bggId, collections, entries, game: await store.game(item.bggId) }
    },
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
      const { added, removed } = await applyMembership(services, list, item, before, after)
      onClose()
      toast([added && `Added ${item.name} to ${plural(added)}`, removed && `Removed it from ${plural(removed)}`].filter(Boolean).join('. '))
    } finally {
      setBusy(false)
    }
  }

  const description = ready?.game?.description
  return (
    <Sheet open title={item.name} onClose={onClose}>
      <div className="detail-head">
        <HexCover game={ready?.game ?? { ...item, year: null, description: null, kind: 'boardgame' }} name={item.name} size={84} />
        <div>
          <p className="detail-sub">{ready?.game?.year ? `${ready.game.year} · ${list.title}` : list.title}</p>
          <a className="link-out" href={gameUrl(item.bggId)} target="_blank" rel="noopener noreferrer">
            Open on BoardGameGeek
          </a>
        </div>
      </div>
      <p className="description">{description || 'The description is filled in from BoardGameGeek later.'}</p>
      {list.isEssen && <FactsList facts={item.facts} />}
      <h3 className="section-title">In collections</h3>
      {ready && ready.collections.length === 0 ? (
        <p className="lead">
          You have no collection yet. <a href={href({ name: 'add', what: 'collection' })}>Create a collection</a>, then come back to this list.
        </p>
      ) : (
        <>
          <p className="lead">Tick every collection this game should be in, then press Done.</p>
          <div className="picks">
            {ready?.collections.map(c => (
              <Pick
                key={c.id}
                collection={c}
                checked={after.has(c.id)}
                note={note(
                  c,
                  ready.entries.find(e => e.collectionId === c.id),
                  after.has(c.id),
                  list.isEssen,
                )}
                onChange={on => toggle(c.id, on)}
              />
            ))}
          </div>
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

/** A row of the multi-choice list: hexagon tick, collection name and what Done does (docs/design.md §7). */
function Pick({ collection, checked, note, onChange }: { collection: Collection; checked: boolean; note: string; onChange: (on: boolean) => void }) {
  const nameId = useId()
  const noteId = useId()
  return (
    <label className="pick">
      <input type="checkbox" className="pick-input" checked={checked} aria-labelledby={nameId} aria-describedby={noteId} onChange={e => onChange(e.target.checked)} />
      <span className="tick hex" aria-hidden="true" />
      <span className="pick-text">
        <span className="pick-name">
          <span id={nameId}>{collection.name}</span> {collection.type === 'essen' && <EssenBadge />}
        </span>
        <small id={noteId}>{note}</small>
      </span>
    </label>
  )
}
