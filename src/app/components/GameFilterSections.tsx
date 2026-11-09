import { type ReactNode, useEffect, useState } from 'react'

import { type FilterDetails, type GameFilter, type LengthLimits, PLAYER_KINDS, lengthOf, lengthRanges, missingCounts, valueCounts } from '../../domain/game-filter.ts'
import { type PollKind, pollKind } from '../../domain/player-poll.ts'
import { RangeSlider, rangeText } from './RangeSlider.tsx'

/** How many values a pick list shows before "Show all" (design.md "Mechanisms and Designers"). */
const FIRST = 8
const NUMBERS = [1, 2, 3, 4, 5, 6]
const KIND_NAMES: Record<PollKind, string> = { best: 'Best', rec: 'Recommended' }

const games = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`
const have = (n: number) => `${games(n)} ${n === 1 ? 'has' : 'have'}`

/**
 * F009 (docs/design.md "List filter"): the sections of the game filter: Length, Players, Rating, Geek
 * rating, Mechanisms and Designers, each offering the values found in `games` with their counts.
 * Changes go straight to `onChange`. Shared by a BGG list's "Filter" sheet and the shopping lists'
 * "Filter and group" sheet; `games` are the details of the list's games that are on the device.
 */
export function GameFilterSections({
  filter,
  onChange,
  games: details,
  limits,
}: {
  filter: GameFilter
  onChange: (filter: GameFilter) => void
  games: FilterDetails[]
  limits: LengthLimits
}) {
  const known = details.filter(Boolean)
  const missing = missingCounts(known, filter)
  return (
    <div className="game-filter">
      <LengthSection filter={filter} onChange={onChange} known={known} limits={limits} missing={missing.length} />
      <PlayersSection filter={filter} onChange={onChange} known={known} missing={missing.players} />
      <RatingSection title="Rating" note="BGG average" field="rating" filter={filter} onChange={onChange} missing={missing.rating} />
      <RatingSection title="Geek rating" field="geekRating" filter={filter} onChange={onChange} missing={missing.geekRating} />
      <PickSection title="Mechanisms" singular="mechanism" field="mechanisms" filter={filter} onChange={onChange} known={known} />
      <PickSection title="Designers" singular="designer" field="designers" filter={filter} onChange={onChange} known={known} />
    </div>
  )
}

export function SectionHead({ title, note, children }: { title: string; note?: string; children?: ReactNode }) {
  return (
    <div className="f-head">
      <h3>{title}</h3>
      {note && <small>{note}</small>}
      {children}
    </div>
  )
}

type SectionProps = { filter: GameFilter; onChange: (filter: GameFilter) => void; known: FilterDetails[] }

function LengthSection({ filter, onChange, known, limits, missing }: SectionProps & { limits: LengthLimits; missing: number }) {
  const toggle = (range: GameFilter['length'][number]) =>
    onChange({ ...filter, length: filter.length.includes(range) ? filter.length.filter(r => r !== range) : [...filter.length, range] })
  return (
    <section className="f-sec">
      <SectionHead title="Length" note="any ticked one" />
      <div className="chips" role="group" aria-label="Length">
        {lengthRanges(limits).map(({ range, name, text }) => (
          <button key={range} type="button" className="chip" aria-pressed={filter.length.includes(range)} onClick={() => toggle(range)}>
            {name} · {text}
            <small>{known.filter(d => lengthOf(d?.playingTime, limits) === range).length}</small>
          </button>
        ))}
      </div>
      {missing > 0 && <p className="missing">{have(missing)} no length on BoardGameGeek.</p>}
    </section>
  )
}

/**
 * Players: chips 1–6 and a field for any other number, kept as typed (so 10 can be typed through 1);
 * with a number, Best and Recommended (both by default, one always stays ticked).
 */
function PlayersSection({ filter, onChange, known, missing }: SectionProps & { missing: number }) {
  const players = filter.players
  const [typed, setTyped] = useState(() => (players && !NUMBERS.includes(players.n) ? String(players.n) : ''))
  // the filter changed elsewhere (Clear filters, a chip): the field lets go of a number no longer chosen
  useEffect(() => {
    const n = Number.parseInt(typed, 10)
    if (n >= 1 && n <= 99 && players?.n !== n) setTyped('')
  }, [players, typed])
  const kinds = players?.kinds ?? PLAYER_KINDS
  const choose = (n: number | null) => onChange({ ...filter, players: n === null ? null : { n, kinds: [...kinds] } })
  const tap = (n: number) => {
    setTyped('')
    choose(players?.n === n && !typed ? null : n)
  }
  const type = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2)
    const n = Number.parseInt(digits, 10)
    setTyped(digits)
    choose(n >= 1 && n <= 99 ? n : null)
  }
  const toggleKind = (kind: PollKind) => {
    if (!players) return
    const next = players.kinds.includes(kind) ? players.kinds.filter(k => k !== kind) : [...players.kinds, kind]
    // one kind always stays ticked: unticking the last one ticks the other
    const kept = next.length > 0 ? next : PLAYER_KINDS.filter(k => k !== kind)
    onChange({ ...filter, players: { n: players.n, kinds: PLAYER_KINDS.filter(k => kept.includes(k)) } })
  }
  const kindOf = (d: FilterDetails) => (players ? pollKind(d?.playerPoll, players.n) : null)
  const matching = players ? known.filter(d => players.kinds.includes(kindOf(d) as PollKind)).length : 0
  return (
    <section className="f-sec">
      <SectionHead title="Players" note="BGG's player poll" />
      <div className="chips player-chips" role="group" aria-label="Number of players">
        {NUMBERS.map(n => (
          <button key={n} type="button" className="chip num" aria-pressed={players?.n === n && !typed} onClick={() => tap(n)}>
            {n}
          </button>
        ))}
        <label className={`field num-field${typed ? ' is-set' : ''}`}>
          <span className="visually-hidden">Other number of players</span>
          <input type="text" inputMode="numeric" maxLength={2} placeholder="7+" autoComplete="off" value={typed} onChange={e => type(e.target.value)} />
        </label>
      </div>
      {players ? (
        <>
          <div className="chips player-kinds" role="group" aria-label={`With ${players.n} players the game is`}>
            {PLAYER_KINDS.map(kind => (
              <button key={kind} type="button" className="chip" aria-pressed={players.kinds.includes(kind)} onClick={() => toggleKind(kind)}>
                {KIND_NAMES[kind]}
                <small>{known.filter(d => kindOf(d) === kind).length}</small>
              </button>
            ))}
          </div>
          <p className="missing">
            {games(matching)} {players.kinds.map(k => (k === 'best' ? 'best' : 'recommended')).join(' or ')} with {players.n} players.{' '}
            {typed ? 'Clear the field' : 'Tap the number again'} for any.
          </p>
          {missing > 0 && <p className="missing">{have(missing)} no player poll for {players.n} players.</p>}
        </>
      ) : (
        <p className="missing">Pick a number of players.</p>
      )}
    </section>
  )
}

/** Rating or Geek rating (US2): a two-handle slider 0–10; the full width does not filter. */
function RatingSection({
  title,
  note,
  field,
  filter,
  onChange,
  missing,
}: Omit<SectionProps, 'known'> & { title: string; note?: string; field: 'rating' | 'geekRating'; missing: number }) {
  return (
    <section className="f-sec">
      <SectionHead title={title} note={note}>
        <span className="val" aria-hidden="true">
          {rangeText(filter[field])}
        </span>
      </SectionHead>
      <RangeSlider label={title} value={filter[field]} onChange={value => onChange({ ...filter, [field]: value })} />
      {missing > 0 && (
        <p className="missing">
          {have(missing)} no {title.toLowerCase()} on BoardGameGeek.
        </p>
      )}
    </section>
  )
}

/** Mechanisms or Designers: checkbox rows with counts, the 8 most common first, Show all and a find field. */
function PickSection({
  title,
  singular,
  field,
  filter,
  onChange,
  known,
}: SectionProps & { title: string; singular: string; field: 'mechanisms' | 'designers' }) {
  const [showAll, setShowAll] = useState(false)
  const [query, setQuery] = useState('')
  const all = valueCounts(known, field)
  const ticked = filter[field]
  const q = query.trim().toLowerCase()
  const shown = q ? all.filter(v => v.value.toLowerCase().includes(q)) : showAll ? all : all.slice(0, FIRST)
  // ticked values no longer in the list stay, with 0, so the person sees why nothing matches
  const gone = ticked.filter(v => !all.some(c => c.value === v)).map(value => ({ value, count: 0 }))
  const toggle = (value: string) => onChange({ ...filter, [field]: ticked.includes(value) ? ticked.filter(v => v !== value) : [...ticked, value] })
  return (
    <section className="f-sec">
      <SectionHead title={title} note="every ticked one">
        {all.length > FIRST && !q && (
          <button type="button" className="link-btn" onClick={() => setShowAll(s => !s)}>
            {showAll ? 'Show fewer' : `Show all (${all.length})`}
          </button>
        )}
      </SectionHead>
      {all.length > FIRST && (
        <div className="field f-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input type="search" aria-label={`Find in ${title}`} placeholder={`Find ${singular}`} autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      )}
      <div role="group" aria-label={title}>
        {[...gone, ...shown].map(({ value, count }) => (
          <label key={value} className="filter-row">
            <input type="checkbox" checked={ticked.includes(value)} onChange={() => toggle(value)} />
            <span>{value}</span>
            <small>{count}</small>
          </label>
        ))}
        {gone.length + shown.length === 0 && <p className="missing">{all.length === 0 ? 'None yet.' : `No ${singular} matches.`}</p>}
      </div>
    </section>
  )
}
