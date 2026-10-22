import { useState } from 'react'

import { type Conflict, type FactField, conflictKey } from '../../domain/facts.ts'
import { useServices } from '../context.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

type Choice = 'bgg' | 'own'

const FIELD_LABEL: Record<FactField, string> = { booth: 'Booth', price: 'Price', publisher: 'Publisher', edition: 'Edition' }

/**
 * F005 "Resync and conflicts" (docs/design.md §7): a hand-typed field that differs from BGG's value
 * after a resync. Own is preselected for each conflict; Use BGG / Use own for all apply and close at
 * once; Later keeps the own values and closes (the conflict comes back on the next resync); Apply
 * writes the choices (FR-024, FR-025). Closing without applying changes nothing.
 */
export function ConflictsSheet({
  conflicts,
  names,
  collections,
  onClose,
}: {
  conflicts: Conflict[]
  /** Game names by BGG id, from the list. */
  names: ReadonlyMap<number, string>
  /** Collection names by id. */
  collections: ReadonlyMap<string, string>
  onClose: () => void
}) {
  const services = useServices()
  const toast = useToast()
  const [choices, setChoices] = useState<Record<string, Choice>>(() => Object.fromEntries(conflicts.map(c => [conflictKey(c), 'own' as const])))

  const settle = async (picked: Record<string, Choice>) => {
    await services.lists.settleConflicts(conflicts, picked)
    const taken = conflicts.filter(c => picked[conflictKey(c)] === 'bgg').length
    toast(taken > 0 ? `${taken} ${taken === 1 ? 'value' : 'values'} taken from BGG` : 'Your own values kept')
    onClose()
  }
  const all = (choice: Choice) => Object.fromEntries(conflicts.map(c => [conflictKey(c), choice]))

  const count = conflicts.length
  return (
    <Sheet open title="Conflicts" onClose={onClose}>
      <p className="conflicts-count">{`${count} ${count === 1 ? 'conflict' : 'conflicts'}`}</p>
      <p className="hint">You typed these in yourself, and BGG now says something else. Choose what to keep.</p>
      <div className="all-row">
        <button type="button" className="btn" onClick={() => void settle(all('bgg'))}>
          Use BGG for all
        </button>
        <button type="button" className="btn" onClick={() => void settle(all('own'))}>
          Use own for all
        </button>
      </div>
      {conflicts.map(conflict => {
        const key = conflictKey(conflict)
        const name = names.get(conflict.bggId) ?? `Game ${conflict.bggId}`
        return (
          <div key={key} className="conflict" role="group" aria-label={`${FIELD_LABEL[conflict.field].toLowerCase()} of ${name}`}>
            <p className="conflict-game">{name}</p>
            <p className="conflict-where">{`${FIELD_LABEL[conflict.field]} · in ${collections.get(conflict.collectionId) ?? 'a collection'}`}</p>
            <div className="conflict-choices">
              <button type="button" className="choice" aria-pressed={choices[key] === 'own'} onClick={() => setChoices({ ...choices, [key]: 'own' })}>
                Own {conflict.own}
              </button>
              <button type="button" className="choice" aria-pressed={choices[key] === 'bgg'} onClick={() => setChoices({ ...choices, [key]: 'bgg' })}>
                BGG {conflict.bgg}
              </button>
            </div>
          </div>
        )
      })}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Later
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void settle(choices)}>
          Apply
        </button>
      </div>
    </Sheet>
  )
}
