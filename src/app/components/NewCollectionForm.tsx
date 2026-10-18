import { type FormEvent, useId, useState } from 'react'

import { type Collection, NAME_MAX } from '../../domain/collection.ts'
import { createCollection } from '../actions.ts'
import { useServices } from '../context.tsx'

/** Name and "Create collection", enabled once a name is typed. */
export function NewCollectionForm({ initialName = '', nameLabel = 'Name', onCreated }: { initialName?: string; nameLabel?: string; onCreated: (collection: Collection) => void }) {
  const services = useServices()
  const [name, setName] = useState(initialName)
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
          {nameLabel}
        </label>
        <div className="field">
          <input id={nameId} value={name} maxLength={NAME_MAX} placeholder="e.g. Essen 2026" autoComplete="off" onChange={e => setName(e.target.value)} />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
        Create collection
      </button>
    </form>
  )
}
