import { useId, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import {
  type BggCollectionItem,
  NO_STATUS,
  PRIORITY_NAMES,
  STATUS_KEYS,
  STATUS_NAMES,
  type Status,
  type StatusKey,
  type WishlistPriority,
  diff,
  hasAny,
  isSet,
} from '../../domain/bgg-status.ts'
import { useServices } from '../context.tsx'
import { saveOnBgg, useBggAccount, useOnline } from '../hooks/useBggAccount.ts'
import { Badge, BggBadges, useBgg } from './BggBadges.tsx'
import { useToast } from './Toast.tsx'

/** Folded or not, and the switches as the person set them; kept by the game sheet across the sign-in. */
export type BggStatusState = { open: boolean; draft?: Status }

const REFUSED = 'BoardGameGeek did not take the change. Nothing was changed.'
const PRIORITIES: WishlistPriority[] = [1, 2, 3, 4, 5]

/**
 * F008 (US4, docs/design.md "BGG status section"): a folded block in the game sheet with the game's
 * badges in its header; unfolded one switch per status (Wishlist with its priority 1–5), "· changed"
 * on changed lines, and Save on BoardGameGeek (only the changed keys, FR-017) or, signed out, Sign in
 * to save. Offline the switches are disabled; a refused save keeps the choices with Try again.
 */
export function BggStatusSection({
  game,
  state,
  onState,
  onSignIn,
  onSaved,
}: {
  game: Omit<BggCollectionItem, 'status'>
  state: BggStatusState
  onState: (state: BggStatusState) => void
  onSignIn: () => void
  onSaved: () => void
}) {
  const services = useServices()
  const toast = useToast()
  const bodyId = useId()
  const bgg = useBgg()
  const { signedInAs } = useBggAccount()
  const online = useOnline()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<string>()
  if (!bgg.username) return null

  const before = bgg.statuses.get(game.bggId) ?? NO_STATUS
  const draft = state.draft ?? before
  const change = diff(before, draft)
  const changed = (key: StatusKey) => key in change
  const anyChange = Object.keys(change).length > 0
  const disabled = !online || saving
  const set = (next: Partial<Status>) => {
    setFailed(undefined)
    onState({ ...state, draft: { ...draft, ...next } })
  }

  const save = async () => {
    if (!anyChange || disabled) return
    setSaving(true)
    setFailed(undefined)
    try {
      await saveOnBgg(services, bgg.username, game, { status: change })
      toast('Saved on BoardGameGeek')
      onSaved()
    } catch (error) {
      setSaving(false)
      const code = error instanceof ApiError ? error.code : undefined
      setFailed(
        code === 'bgg_signed_out'
          ? 'BoardGameGeek ended the sign-in. Sign in again; your choices are kept.'
          : code === 'offline'
            ? 'No connection. Nothing was changed.'
            : REFUSED,
      )
    }
  }

  return (
    <section className="prices-sec st-sec">
      <button type="button" className="prices-toggle" aria-expanded={state.open} aria-controls={bodyId} onClick={() => onState({ ...state, open: !state.open })}>
        <span aria-hidden="true">📦</span>
        BGG status
        <span className="st-head">
          {hasAny(before) ? (
            <BggBadges bggId={game.bggId} max={2} />
          ) : (
            bgg.known && <small>not in your collection</small>
          )}
        </span>
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="st-body" id={bodyId} hidden={!state.open}>
        {state.open && (
          <>
            <p className="lead">
              {!online
                ? 'Changing statuses needs a connection.'
                : signedInAs
                  ? `Signed in as ${signedInAs}. Only what you change is written.`
                  : 'Sign in to BoardGameGeek to change them.'}
            </p>
            {STATUS_KEYS.map(key => (
              <div key={key} className="st-item">
                <label className={`toggle st-line${changed(key) ? ' changed' : ''}`}>
                  <span className="toggle-text">
                    <Badge statusKey={key} status={draft} colours={bgg.colours} />
                    {changed(key) && <span className="changed">· changed</span>}
                  </span>
                  <input
                    type="checkbox"
                    className="switch"
                    aria-label={STATUS_NAMES[key]}
                    checked={isSet(draft, key)}
                    disabled={disabled}
                    onChange={e => set(key === 'wishlist' ? { wishlist: e.target.checked ? 3 : null } : { [key]: e.target.checked })}
                  />
                </label>
                {key === 'wishlist' && draft.wishlist !== null && (
                  <div className="prio">
                    <div className="seg" role="group" aria-label="Wishlist priority">
                      {PRIORITIES.map(p => (
                        <button key={p} type="button" aria-pressed={draft.wishlist === p} disabled={disabled} onClick={() => set({ wishlist: p })}>
                          {p}
                        </button>
                      ))}
                    </div>
                    <p>
                      {draft.wishlist} · {PRIORITY_NAMES[draft.wishlist]}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {failed && (
              <div className="fail-line" role="alert">
                <span>{failed}</span>
                {signedInAs && (
                  <button type="button" className="link-btn" onClick={() => void save()}>
                    Try again
                  </button>
                )}
              </div>
            )}
            <div className="sheet-actions">
              {signedInAs ? (
                <button type="button" className="btn btn-primary btn-block" disabled={!anyChange || disabled} onClick={() => void save()}>
                  {saving ? 'Saving on BoardGameGeek…' : 'Save on BoardGameGeek'}
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-block" disabled={!anyChange || !online} onClick={onSignIn}>
                  Sign in to save on BoardGameGeek
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
