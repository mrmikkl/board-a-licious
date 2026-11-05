import { useState } from 'react'

import type { Game } from '../../client/types.ts'
import type { SearchResult } from '../../domain/bgg-search.ts'
import type { Mark } from '../../domain/marks.ts'
import { memberships } from '../../domain/membership.ts'
import { useServices, useStoreData } from '../context.tsx'
import { applyMembership } from '../list-actions.ts'
import { href } from '../router.ts'
import { CategoryPicker } from './CategoryPicker.tsx'
import { HexCover } from './HexCover.tsx'
import { Pick, note } from './MembershipSheet.tsx'
import { yearText } from './SearchResultRow.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

const plural = (n: number) => `${n} ${n === 1 ? 'collection' : 'collections'}`

/**
 * F006: the + of a search result (docs/design.md "Add to collections sheet"): the collection ticks of a
 * BGG list's game sheet, starting from where the game is now, and the optional category; Done applies.
 */
export function AddToCollectionsSheet({ result, game, onClose }: { result: SearchResult; game?: Game; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const [ticked, setTicked] = useState<Set<string>>()
  const [mark, setMark] = useState<Mark>('new')
  const [busy, setBusy] = useState(false)
  const name = game?.name || result.name
  const data = useStoreData(
    async store => ({
      collections: (await store.collections()).filter(c => !c.deleted).sort((a, b) => a.name.localeCompare(b.name)),
      entries: (await store.allEntries()).filter(e => e.bggId === result.bggId && !e.deleted),
    }),
    [result.bggId],
  )
  const before = data ? memberships(data.entries, result.bggId) : new Set<string>()
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
      // the details already loaded for the result go along, so the rows show them at once
      if (game) await services.store.putGames([game])
      const { added, removed } = await applyMembership(services, { bggId: result.bggId, name, thumbnailUrl: game?.thumbnailUrl ?? null }, before, after, mark)
      onClose()
      toast([added && `Added ${name} to ${plural(added)}`, removed && `Removed it from ${plural(removed)}`].filter(Boolean).join('. '))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open title={`Add ${name}`} onClose={onClose}>
      <div className="found">
        <HexCover game={game} name={name} size={48} />
        <span className="row-meta">
          <span className="row-name">{name}</span>
          <span className="row-sub">
            {yearText(result.year)}
            {result.kind === 'expansion' && <span className="kind-pill">Expansion</span>}
          </span>
        </span>
      </div>
      {data && data.collections.length === 0 ? (
        <p className="lead">
          You have no collection yet. <a href={href({ name: 'collections', create: true })}>Create a collection</a>, then search again.
        </p>
      ) : (
        <>
          <p className="lead">Tick every collection this game should be in, then press Done.</p>
          <div className="picks">
            {data?.collections.map(c => (
              <Pick
                key={c.id}
                collection={c}
                checked={after.has(c.id)}
                note={note(
                  data.entries.find(e => e.collectionId === c.id),
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
        <button type="button" className="btn btn-primary btn-block" disabled={!data || busy} onClick={() => void done()}>
          Done
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Sheet>
  )
}
