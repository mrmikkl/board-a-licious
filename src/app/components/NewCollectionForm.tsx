import { type FormEvent, useId, useState } from 'react'

import { type Collection, NAME_MAX } from '../../domain/collection.ts'
import { createCollection } from '../actions.ts'
import { useServices } from '../context.tsx'

/** The New collection sheet's form: Name, Cancel / "Create collection", enabled once a name is typed. */
export function NewCollectionForm({ onCreated, onCancel }: { onCreated: (collection: Collection) => void; onCancel: () => void }) {
  const services = useServices()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const nameId = useId()
  const valid = name.trim().length > 0 && name.trim().length <= NAME_MAX
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      onCreated(await createCollection(services, name))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      <div>
        <label className="label" htmlFor={nameId}>
          Name
        </label>
        <div className="field">
          <input id={nameId} value={name} maxLength={NAME_MAX} placeholder="e.g. Essen 2026" autoComplete="off" onChange={e => setName(e.target.value)} />
        </div>
      </div>
      <div className="sheet-actions sheet-actions-row">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
          Create collection
        </button>
      </div>
    </form>
  )
}
