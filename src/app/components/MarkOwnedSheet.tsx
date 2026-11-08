import { useState } from 'react'

import { ApiError, type BggSaveBody, type Money } from '../../client/api.ts'
import { type BggCollectionItem, NO_STATUS, type PrivateInfo, type Status, askAfterBought, privateInfoFor } from '../../domain/bgg-status.ts'
import type { Paid } from '../../domain/collection.ts'
import { formatMoney } from '../../domain/money.ts'
import { useServices } from '../context.tsx'
import { saveOnBgg, useBggAccount } from '../hooks/useBggAccount.ts'
import { useBgg } from './BggBadges.tsx'
import { Sheet } from './Sheet.tsx'
import { SignInSheet } from './SignInSheet.tsx'
import { useToast } from './Toast.tsx'

/** The currencies BGG takes for a price paid (research R3); BGG calls the yen "YEN". */
const BGG_CURRENCIES: Record<string, string> = { EUR: 'EUR', USD: 'USD', GBP: 'GBP', CAD: 'CAD', AUD: 'AUD', JPY: 'YEN', YEN: 'YEN' }

/** What was bought: the game, the price paid in the app, and the booth when it came from a SPIEL preview. */
export type Bought = { game: Omit<BggCollectionItem, 'status'>; paid: Paid | null; booth?: string | null; fromSpiel?: boolean }

/** Whether to ask after Got it (FR-021): only for people using BGG, and only when something would change. */
export function markOwnedMode(usesBgg: boolean, status: Status | undefined, paid: Paid | null) {
  if (!usesBgg) return null
  return askAfterBought(status, Boolean(paid && BGG_CURRENCIES[paid.currency]))
}

const money = ({ amount, currency }: Money) => formatMoney(Math.round(amount * 100), currency)
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * F008 (US5, docs/design.md "Mark as owned sheet"): after Got it, "Also mark as owned on BoardGameGeek?"
 * (owned already: "Add the price paid …") with what is written (Status Owned, Price paid, Acquisition
 * date, Acquired from). Nothing is written without the tap; signed out, the sign-in comes first. When
 * BGG already has another price paid: "Replace the price paid …" with Keep <old> / Replace.
 */
export function MarkOwnedSheet({ bought, mode, onClose }: { bought: Bought; mode: 'markOwned' | 'addPrice'; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const bgg = useBgg()
  const { signedInAs } = useBggAccount()
  const [step, setStep] = useState<'ask' | 'signin' | 'saving' | 'conflict' | 'failed'>('ask')
  const [conflict, setConflict] = useState<Money>()
  const [failure, setFailure] = useState('')
  const [info] = useState<PrivateInfo>(() => {
    const currency = bought.paid ? BGG_CURRENCIES[bought.paid.currency] : undefined
    return privateInfoFor(
      {
        pricePaid: bought.paid && currency ? { amount: bought.paid.cents / 100, currency } : undefined,
        booth: bought.booth,
        fromSpiel: bought.fromSpiel,
      },
      new Date(),
    )
  })
  const { name } = bought.game
  const owned = mode === 'addPrice'

  const save = async (replacePrice?: boolean) => {
    setStep('saving')
    const status = bgg.statuses.get(bought.game.bggId) ?? NO_STATUS
    const body: BggSaveBody = { ...(status.own ? {} : { status: { own: true } }), privateInfo: info, ...(replacePrice === undefined ? {} : { replacePrice }) }
    try {
      const result = await saveOnBgg(services, bgg.username, bought.game, body)
      if (result.kind === 'conflict') {
        setConflict(result.current)
        return setStep('conflict')
      }
      onClose()
      toast(`Saved on BoardGameGeek: ${name} owned${info.pricePaid && replacePrice !== false ? ', price paid added' : ''}`)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'bgg_signed_out') return setStep('signin')
      setFailure(
        error instanceof ApiError && error.code === 'offline'
          ? 'No connection. Nothing was changed there.'
          : 'BoardGameGeek did not take the change. Nothing was changed there.',
      )
      setStep('failed')
    }
  }
  const confirm = () => (signedInAs ? void save() : setStep('signin'))

  if (step === 'signin') return <SignInSheet onSignedIn={() => void save()} onCancel={() => setStep('ask')} />
  if (step === 'saving')
    return (
      <Sheet open title={owned ? 'Add the price paid on BoardGameGeek?' : 'Also mark as owned on BoardGameGeek?'} onClose={onClose}>
        <p className="result-status" role="status">
          <span className="spin-hex" aria-hidden="true" />
          Saving on BoardGameGeek…
        </p>
      </Sheet>
    )
  if (step === 'failed')
    return (
      <Sheet open title="Not saved on BoardGameGeek" onClose={onClose}>
        <div className="fail-line" role="alert">
          <span>{failure}</span>
          <button type="button" className="link-btn" onClick={() => void save()}>
            Try again
          </button>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-block" onClick={onClose}>
            Close
          </button>
        </div>
      </Sheet>
    )
  if (step === 'conflict' && conflict)
    return (
      <Sheet open title="Replace the price paid on BoardGameGeek?" onClose={onClose}>
        <p className="hint">BoardGameGeek already has a price paid for {name}.</p>
        <dl className="kv">
          <dt>Price paid</dt>
          <dd>
            <span className="old">{money(conflict)}</span>
            {info.pricePaid && money(info.pricePaid)}
          </dd>
        </dl>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => void save(false)}>
            Keep {money(conflict)}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save(true)}>
            Replace
          </button>
        </div>
      </Sheet>
    )

  return (
    <Sheet open title={owned ? 'Add the price paid on BoardGameGeek?' : 'Also mark as owned on BoardGameGeek?'} onClose={onClose}>
      <p className="hint">{owned ? `${name} is already owned on BoardGameGeek.` : `${name} is not in your owned games on BoardGameGeek yet.`}</p>
      <dl className="kv">
        {!owned && (
          <>
            <dt>Status</dt>
            <dd>Owned</dd>
          </>
        )}
        {info.pricePaid && (
          <>
            <dt>Price paid</dt>
            <dd>{money(info.pricePaid)}</dd>
          </>
        )}
        <dt>Acquisition date</dt>
        <dd>{day(info.acquisitionDate!)}</dd>
        {info.acquiredFrom && (
          <>
            <dt>Acquired from</dt>
            <dd>{info.acquiredFrom}</dd>
          </>
        )}
      </dl>
      <p className="private-note">Price, date and where from go into the game's private info on BGG, which only you see.</p>
      {!signedInAs && <p className="hint">You'll sign in to BoardGameGeek first (once on this device).</p>}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          Not now
        </button>
        <button type="button" className="btn btn-primary" onClick={confirm}>
          {owned ? 'Add price' : 'Mark as owned'}
        </button>
      </div>
    </Sheet>
  )
}
