import { type FormEvent, useEffect, useId, useState } from 'react'

import { DEFAULT_LENGTH_LIMITS, type LengthLimits, LENGTH_RANGES, lengthRanges, validLengthLimits } from '../../domain/game-filter.ts'
import { useServices, useStoreData } from '../context.tsx'
import { useToast } from './Toast.tsx'

const NAMES = lengthRanges(DEFAULT_LENGTH_LIMITS).map(r => r.name)

/**
 * F009 US3 (docs/design.md "Game length"): where Short, Middle and Long end, in minutes; Very long has
 * no end. Synced to the other devices like the BGG username.
 */
export function LengthSettings() {
  const services = useServices()
  const toast = useToast()
  const hintId = useId()
  const saved = useStoreData(store => store.lengthLimits())
  const [draft, setDraft] = useState<string[]>()
  // the fields start with the saved limits once they are read
  useEffect(() => {
    if (saved) setDraft(current => current ?? saved.map(String))
  }, [saved])
  const values = draft ?? DEFAULT_LENGTH_LIMITS.map(String)
  const limits = values.map(v => (/^\d+$/.test(v.trim()) ? Number(v) : NaN))
  const ok = validLengthLimits(limits)
  const isDefault = limits.every((v, i) => v === DEFAULT_LENGTH_LIMITS[i])
  const texts = ok ? lengthRanges(limits).map(r => r.text) : LENGTH_RANGES.map((_, i) => (i === 0 && limits[0]! > 0 ? `0–${limits[0]} min` : '…'))
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!ok) return
    await services.store.setLengthLimits(limits as LengthLimits)
    void services.sync.schedule()
    toast('Saved the game length')
  }
  return (
    <section aria-labelledby="length-title">
      <h2 id="length-title" className="section-title">
        Game length
      </h2>
      <form onSubmit={e => void save(e)}>
        <p className="hint len-hint" id={hintId}>
          The four lengths for the Filter in lists, from BoardGameGeek's playing time. Type where each one ends; the next starts one minute later.
        </p>
        <div className="len-rows">
          {NAMES.map((name, i) => (
            <div className="len-row" key={name}>
              <b>{name}</b>
              <span className="len-span">{texts[i]}</span>
              {i < 3 ? (
                <div className="field">
                  <input
                    inputMode="numeric"
                    value={values[i]}
                    aria-label={`${name} ends at minutes`}
                    aria-describedby={hintId}
                    onChange={e => setDraft(values.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                </div>
              ) : (
                <span />
              )}
            </div>
          ))}
        </div>
        {!ok && (
          <p className="hint error" role="alert">
            Each length must end after the one before.
          </p>
        )}
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" disabled={isDefault} onClick={() => setDraft(DEFAULT_LENGTH_LIMITS.map(String))}>
            Reset
          </button>
          <button type="submit" className="btn btn-primary" disabled={!ok}>
            Save game length
          </button>
        </div>
      </form>
    </section>
  )
}
