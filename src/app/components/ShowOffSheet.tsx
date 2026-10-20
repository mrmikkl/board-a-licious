import { useState } from 'react'

import { MARKS, type Mark, markInfo } from '../../domain/marks.ts'
import { useServices, useStoreData } from '../context.tsx'
import { navigate } from '../router.ts'
import { Sheet } from './Sheet.tsx'

/** The six groups in the collection's order (docs/design.md "Show-off"). */
const GROUPS: Mark[] = ['must_have', 'interested', 'unsure', 'poop', 'new', 'skip']

/** The groups last shown off in this collection; the first time Must Have (data-model "Show-off choice"). */
function rememberedGroups(stored: unknown): Mark[] {
  const known = new Set<string>(MARKS.map(m => m.key))
  const groups = Array.isArray(stored) ? stored.filter((g): g is Mark => typeof g === 'string' && known.has(g)) : []
  return groups.length > 0 ? groups : ['must_have']
}

/**
 * F004 FR-008, FR-009 (docs/design.md "Show-off"): a multi-choice list of the six groups with emoji,
 * label, count and a hexagon tick, updated in place; Cancel / Show off (disabled while none is
 * chosen). Show off remembers the choice for this collection on the device and opens the screen.
 */
export function ShowOffSheet({ collectionId, counts, onClose }: { collectionId: string; counts: Record<Mark, number>; onClose: () => void }) {
  const services = useServices()
  const stored = useStoreData(async store => ({ groups: rememberedGroups((await store.meta('showOff'))?.[collectionId]) }), [collectionId])
  if (!stored) return null
  return <Choice key={collectionId} collectionId={collectionId} initial={stored.groups} counts={counts} services={services} onClose={onClose} />
}

function Choice({
  collectionId,
  initial,
  counts,
  services,
  onClose,
}: {
  collectionId: string
  initial: Mark[]
  counts: Record<Mark, number>
  services: ReturnType<typeof useServices>
  onClose: () => void
}) {
  const [chosen, setChosen] = useState<Set<Mark>>(() => new Set(initial))
  const toggle = (mark: Mark) =>
    setChosen(prev => {
      const next = new Set(prev)
      if (next.has(mark)) next.delete(mark)
      else next.add(mark)
      return next
    })
  const groups = GROUPS.filter(g => chosen.has(g))
  const showOff = async () => {
    const all = (await services.store.meta('showOff')) ?? {}
    await services.store.setMeta('showOff', { ...all, [collectionId]: groups })
    // the sheet's address is replaced by the screen's, so Back from the screen lands on the collection
    navigate({ name: 'showoff', id: collectionId, groups }, { replace: true })
  }
  return (
    <Sheet open title="Show-off" onClose={onClose}>
      <p className="lead">Which groups do you want to show? Their covers fill the screen as a honeycomb.</p>
      <ul className="showoff-groups">
        {GROUPS.map(key => {
          const mark = markInfo(key)
          return (
            <li key={key}>
              <button type="button" className="showoff-group" aria-pressed={chosen.has(key)} onClick={() => toggle(key)}>
                <span className="showoff-tick" aria-hidden="true" />
                <span>
                  <span aria-hidden="true">{mark.emoji}</span> {mark.label}
                </span>
                <span className="showoff-count"> {counts[key]}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="sheet-actions sheet-actions-row">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={groups.length === 0} onClick={() => void showOff()}>
          Show off
        </button>
      </div>
    </Sheet>
  )
}
