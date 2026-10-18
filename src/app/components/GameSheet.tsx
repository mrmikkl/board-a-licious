import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

import type { Game } from '../../client/types.ts'
import { gameUrl } from '../../domain/bgg-link.ts'
import { type Collection, type Entry, type Facts, type Paid, suggestPaid } from '../../domain/collection.ts'
import { gameInfos, publisherOf } from '../../domain/game-info.ts'
import { MARKS, type Mark, markInfo } from '../../domain/marks.ts'
import { CURRENCIES, currencySymbol, formatMoney, parsePrice, priceInput } from '../../domain/money.ts'
import { buyGame, removeGame, saveFacts, setMark, unbuyGame } from '../actions.ts'
import { type Point, centreOf } from '../celebrate.ts'
import { useServices } from '../context.tsx'
import { InfoList } from './GameInfo.tsx'
import { HexCover } from './HexCover.tsx'
import { HexPicker } from './HexPicker.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

const PICKER = MARKS.filter(m => m.key !== 'new' && m.key !== 'skip').map(m => ({
  key: m.key,
  label: m.label,
  tone: m.key,
  icon: (
    <em className="picker-emoji" aria-hidden="true">
      {m.emoji}
    </em>
  ),
}))

const PRICE_ERROR = 'Type a price from 0 to 9,999, like 12,50.'

/**
 * Game details in a collection (FR-006, FR-018): cover, name, year, BGG link, description, booth,
 * price and publisher (FR-011), mark picker, bought with the price paid (FR-007), remove.
 */
export function GameSheet({ entry, game, collection, onClose }: { entry: Entry; game?: Game; collection: Collection; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const [step, setStep] = useState<'details' | 'paid' | 'facts'>('details')
  const name = game?.name ?? `Game ${entry.bggId}`
  // the tapped picker button, where the Must Have burst starts
  const tapped = useRef<Element | null>(null)
  // choosing a mark is the answer: the sheet closes and the game moves to its group
  const mark = (key: Mark) => {
    void setMark(services, entry, key, centreOf(tapped.current))
    onClose()
    toast(`${name}: ${markInfo(key).emoji} ${markInfo(key).label}`)
  }
  const remove = async () => {
    await removeGame(services, entry)
    onClose()
    toast(`Removed ${name} from ${collection.name}`)
  }
  const buy = async (paid: Paid | null, from?: Point) => {
    await buyGame(services, entry, paid, from)
    onClose()
    toast(paid ? `${name}: got it for ${formatMoney(paid.cents, paid.currency)}!` : `${name}: got it!`)
  }
  const unbuy = async () => {
    await unbuyGame(services, entry)
    onClose()
    toast(`${name}: not bought`)
  }
  const save = async (facts: Facts) => {
    await saveFacts(services, entry, facts)
    setStep('details')
    toast(`Saved booth, price and publisher for ${name}`)
  }
  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="detail-head">
        <HexCover game={game} name={name} pending={entry.detailsPending && !game?.thumbnailUrl} bought={entry.bought} size={84} />
        <div>
          <p className="detail-sub">
            {game?.year ? `${game.year} · ${collection.name}` : entry.detailsPending ? 'Details follow from BoardGameGeek' : `Year unknown · ${collection.name}`}
          </p>
          <a className="link-out" href={gameUrl(entry.bggId)} target="_blank" rel="noopener noreferrer">
            Open on BoardGameGeek
          </a>
          {entry.bought && (
            <span className="pill" data-mark="bought">
              ✅ {entry.paidCents != null ? `Bought for ${formatMoney(entry.paidCents, entry.paidCurrency)}` : 'Bought'}
            </span>
          )}
        </div>
      </div>
      <p className="desc">{game?.description || <span className="muted">The description is filled in from BoardGameGeek later.</span>}</p>
      {step === 'facts' ? (
        <FactsForm facts={entry.facts} onSave={facts => void save(facts)} onCancel={() => setStep('details')} />
      ) : (
        <FactsBox entry={entry} game={game} onEdit={() => setStep('facts')} />
      )}
      <div style={{ display: 'contents' }} onClickCapture={e => (tapped.current = (e.target as Element).closest('button'))}>
        <HexPicker label="Mark as" options={PICKER} value={entry.mark} onPick={mark} />
      </div>
      {step === 'paid' ? (
        <PaidForm entry={entry} onSave={(paid, from) => void buy(paid, from)} onCancel={() => setStep('details')} />
      ) : (
        <div className="sheet-actions">
          {entry.bought ? (
            <button type="button" className="btn btn-block" onClick={() => void unbuy()}>
              Not bought after all
            </button>
          ) : (
            <button type="button" className="btn btn-block btn-bought" onClick={() => setStep('paid')}>
              ✅ Bought it
            </button>
          )}
          {entry.mark === 'skip' ? (
            <button type="button" className="btn btn-block" onClick={() => mark('new')}>
              Mark as not yet decided
            </button>
          ) : (
            <button type="button" className="btn btn-block" onClick={() => mark('skip')}>
              🛑 Not interested
            </button>
          )}
          <button type="button" className="btn btn-block btn-danger" onClick={() => void remove()}>
            Remove from collection
          </button>
          <button type="button" className="btn btn-block" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </Sheet>
  )
}

/** Publisher and every info of the game (FR-010); booth, price and publisher typed in say so (FR-011). */
function FactsBox({ entry, game, onEdit }: { entry: Entry; game?: Game; onEdit: () => void }) {
  const facts = entry.facts
  const publisher = publisherOf(facts, game)
  const info = <InfoList facts={facts} details={game} publisher={publisher} />
  if (!facts) {
    return (
      <>
        {(publisher || gameInfos(facts, game).length > 0) && <div className="facts-box">{info}</div>}
        <button type="button" className="btn btn-block facts-add" onClick={onEdit}>
          ➕ Add booth, price and publisher
        </button>
      </>
    )
  }
  return (
    <div className="facts-box">
      {info}
      <div className="facts-foot">
        {entry.factsSource === 'manual' && <span className="facts-by">Added by you</span>}
        <button type="button" className="link-btn" onClick={onEdit}>
          ✎ Edit booth, price and publisher
        </button>
      </div>
    </div>
  )
}

/** Booth, Price with a currency (EUR by default) and Publisher; Save once one of them is filled in. */
function FactsForm({ facts, onSave, onCancel }: { facts: Facts | null; onSave: (facts: Facts) => void; onCancel: () => void }) {
  const id = useId()
  const boothRef = useRef<HTMLInputElement>(null)
  const [booth, setBooth] = useState(facts?.booth ?? '')
  const [price, setPrice] = useState(priceInput(facts?.priceCents))
  const [currency, setCurrency] = useState(facts?.currency ?? 'EUR')
  const [publisher, setPublisher] = useState(facts?.publisher ?? '')
  useEffect(() => boothRef.current?.focus(), [])
  const cents = parsePrice(price)
  const priceInvalid = price.trim() !== '' && cents === null
  const filled = booth.trim() !== '' || price.trim() !== '' || publisher.trim() !== ''
  const currencies = CURRENCIES.includes(currency as (typeof CURRENCIES)[number]) ? CURRENCIES : [...CURRENCIES, currency]
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!filled || priceInvalid) return
    onSave({ booth, priceCents: cents, currency: cents === null ? null : currency, publisher, edition: facts?.edition ?? null })
  }
  return (
    <form className="form facts-form" onSubmit={submit}>
      <div>
        <label className="label" htmlFor={`${id}-booth`}>
          Booth
        </label>
        <div className="field">
          <input id={`${id}-booth`} ref={boothRef} value={booth} maxLength={40} autoComplete="off" placeholder="3-A101" onChange={e => setBooth(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-price`}>
          Price
        </label>
        <div className="price-row">
          <div className="field">
            <input
              id={`${id}-price`}
              value={price}
              inputMode="decimal"
              autoComplete="off"
              placeholder="52"
              aria-invalid={priceInvalid}
              aria-describedby={priceInvalid ? `${id}-price-hint` : undefined}
              onChange={e => setPrice(e.target.value)}
            />
          </div>
          <div className="field select">
            <select aria-label="Currency" value={currency} onChange={e => setCurrency(e.target.value)}>
              {currencies.map(code => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {priceInvalid && (
          <p className="hint error" id={`${id}-price-hint`}>
            {PRICE_ERROR}
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor={`${id}-publisher`}>
          Publisher
        </label>
        <div className="field">
          <input id={`${id}-publisher`} value={publisher} maxLength={80} autoComplete="off" onChange={e => setPublisher(e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={!filled || priceInvalid}>
          Save
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** "What did you pay?", prefilled with the listed price; comma or point, 0–9,999; Enter saves (FR-007). */
function PaidForm({ entry, onSave, onCancel }: { entry: Entry; onSave: (paid: Paid | null, from?: Point) => void; onCancel: () => void }) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestion = suggestPaid(entry)
  const [text, setText] = useState(priceInput(suggestion.cents))
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  const cents = parsePrice(text)
  const invalid = text.trim() !== '' && cents === null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    if (cents !== null) onSave({ cents, currency: suggestion.currency }, centreOf(submitter))
  }
  return (
    <form className="form sheet-actions" onSubmit={submit}>
      <div>
        <label className="label" htmlFor={id}>
          What did you pay?
        </label>
        <div className="field">
          <span className="currency" aria-hidden="true">
            {currencySymbol(suggestion.currency)}
          </span>
          <input
            id={id}
            ref={inputRef}
            value={text}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-invalid={invalid}
            aria-describedby={`${id}-hint`}
            onChange={e => setText(e.target.value)}
          />
        </div>
        <p className={`hint${invalid ? ' error' : ''}`} id={`${id}-hint`}>
          {invalid
            ? PRICE_ERROR
            : suggestion.cents != null
              ? `Listed at ${formatMoney(suggestion.cents, suggestion.currency)}.`
              : `In ${suggestion.currency}, with a comma or a point.`}
        </p>
      </div>
      <button type="submit" className="btn btn-block btn-bought" disabled={cents === null}>
        ✅ Save, got it
      </button>
      <button type="button" className="btn btn-block" onClick={e => onSave(null, centreOf(e.currentTarget))}>
        Don't track the price
      </button>
      <button type="button" className="btn btn-block" onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
