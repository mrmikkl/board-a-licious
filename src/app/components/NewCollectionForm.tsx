import { type FormEvent, useId, useState } from 'react'

import { type Collection, NAME_MAX } from '../../domain/collection.ts'
import { createCollection } from '../actions.ts'
import { useServices } from '../context.tsx'

/** Name, "Essen collection" switch (on by default) and "Create collection", enabled once a name is typed. */
export function NewCollectionForm({ initialName = '', nameLabel = 'Name', onCreated }: { initialName?: string; nameLabel?: string; onCreated: (collection: Collection) => void }) {
  const services = useServices()
  const [name, setName] = useState(initialName)
  const [essen, setEssen] = useState(true)
  const [busy, setBusy] = useState(false)
  const nameId = useId()
  const hintId = useId()
  const valid = name.trim().length > 0 && name.trim().length <= NAME_MAX
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    try {
      onCreated(await createCollection(services, name, essen ? 'essen' : 'standard'))
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
      <label className="toggle">
        <span className="toggle-text">
          Essen collection
          <small id={hintId}>Games from Essen lists (BGG previews) keep booth, price and publisher. The type cannot change later.</small>
        </span>
        <input type="checkbox" role="switch" className="switch" checked={essen} aria-checked={essen} aria-describedby={hintId} onChange={e => setEssen(e.target.checked)} />
      </label>
      <button type="submit" className="btn btn-primary btn-block" disabled={!valid || busy}>
        Create collection
      </button>
    </form>
  )
}
