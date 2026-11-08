import { Fragment, useId, useState } from 'react'

import type { Facts } from '../../domain/collection.ts'
import { type GameDetails, gameInfos, rowInfos } from '../../domain/game-info.ts'
import { type PlayerVotes, pollTable } from '../../domain/player-poll.ts'

type Source = { facts?: Facts | null; details?: Partial<GameDetails> | null }

const Mechanisms = ({ items }: { items: string[] }) => (
  <span className="info-pills">
    {items.map(m => (
      <span key={m} className="pill info-pill">
        {m}
      </span>
    ))}
  </span>
)

/** The third line of a game row: the first three infos (FR-010), mechanisms as pills. */
export function InfoLine({ facts, details }: Source) {
  const infos = rowInfos(facts, details)
  if (infos.length === 0) return null
  const plain = infos.filter(i => !i.items)
  const mechanisms = infos.find(i => i.items)
  return (
    <span className="row-info">
      {plain.length > 0 && <span>{plain.map(i => i.text).join(' · ')}</span>}
      {mechanisms?.items && <Mechanisms items={mechanisms.items} />}
    </span>
  )
}

/** A BGG rating as a small hexagon: rating cool, geek rating dusk (docs/design.md, game info). */
const Rating = ({ value, geek }: { value: string; geek: boolean }) => (
  <span className="rating">
    <i className={geek ? 'geek' : undefined}>{value}</i>
  </span>
)

/** BGG's player poll summary: in the game sheet these live in the Players section, not the info box. */
const PLAYER_KEYS = new Set(['bestWith', 'recommendedWith'])

/**
 * The publisher, then every info a game has in the order of FR-010: game details, swipe card.
 * `players={false}` leaves out Best with, Recommended and the votes (the game sheet's Players section).
 */
export function InfoList({ facts, details, publisher, players = true }: Source & { publisher?: string | null; players?: boolean }) {
  const infos = gameInfos(facts, details).filter(i => players || !PLAYER_KEYS.has(i.key))
  if (infos.length === 0 && !publisher) return null
  return (
    <dl className="info-list">
      {publisher && (
        <div>
          <dt>Publisher</dt>
          <dd>{publisher}</dd>
        </div>
      )}
      {infos.map(i => (
        <Fragment key={i.key}>
          <div>
            <dt>{i.label}</dt>
            <dd>
              {i.key === 'rating' || i.key === 'geekRating' ? (
                <Rating value={i.text} geek={i.key === 'geekRating'} />
              ) : i.items ? (
                <Mechanisms items={i.items} />
              ) : i.key === 'booth' ? (
                i.text.replace(/^Booth /, '')
              ) : (
                i.text
              )}
            </dd>
          </div>
          {/* F006 FR-006b: the poll's votes, folded, right below its summary */}
          {i.key === (infos.some(x => x.key === 'recommendedWith') ? 'recommendedWith' : 'bestWith') && (
            <PlayerPoll poll={details?.playerPoll} voters={details?.playerPollVoters} />
          )}
        </Fragment>
      ))}
    </dl>
  )
}

/**
 * F006 FR-006b: "Show details" unfolds BGG's player poll as a table: per player count the share of
 * Best, Recommended and Not recommended votes; the highest share of each column bold.
 */
export function PlayerPoll({ poll, voters, shown = false }: { poll?: PlayerVotes[] | null; voters?: number | null; shown?: boolean }) {
  const [toggled, setOpen] = useState(false)
  const open = shown || toggled
  const tableId = useId()
  const table = pollTable(poll)
  if (!table) return null
  const cell = (c: { percent: number; highest: boolean }) => <td>{c.highest ? <b>{c.percent}%</b> : `${c.percent}%`}</td>
  return (
    <div className="poll-row">
      <dt className="visually-hidden">Player votes</dt>
      <dd>
        {!shown && (
          <button type="button" className="link-btn poll-toggle" aria-expanded={open} aria-controls={tableId} onClick={() => setOpen(o => !o)}>
            {open ? 'Hide details' : 'Show details'}
          </button>
        )}
        <table id={tableId} className="poll-table" hidden={!open}>
          <caption className="visually-hidden">Votes on BoardGameGeek per number of players, in percent</caption>
          <thead>
            <tr>
              <th scope="col">Players</th>
              <th scope="col">Best</th>
              <th scope="col">Recommended</th>
              <th scope="col">Not recommended</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map(r => (
              <tr key={r.players}>
                <th scope="row">{r.players}</th>
                {cell(r.best)}
                {cell(r.recommended)}
                {cell(r.notRecommended)}
              </tr>
            ))}
          </tbody>
        </table>
        {open && voters ? <p className="poll-voters">{`${voters.toLocaleString('en')} ${voters === 1 ? 'vote' : 'votes'} on BoardGameGeek`}</p> : null}
      </dd>
    </div>
  )
}

/** F008 feedback: the first 200 characters of BGG's description, cut at a word, with "…". */
export function shortText(text: string, max = 200): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/**
 * F008 feedback (docs/design.md "Game sheet"): the game's description at the end of the info box, in
 * small text: the first 200 characters with "…" and Show more / Show less for the full text.
 */
export function Description({ text, note }: { text?: string | null; note?: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  if (!text) return note ? <p className="info-desc muted">{note}</p> : null
  const long = text.length > 200
  return (
    <div className="info-desc">
      <p id={id}>{open || !long ? text : shortText(text)}</p>
      {long && (
        <button type="button" className="link-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

/**
 * F008 feedback (docs/design.md "Players section"): a folded block like Prices: Best with,
 * Recommended and BGG's votes per number of players. Nothing when BGG has no poll for the game.
 */
export function PlayersSection({ details }: { details?: Partial<GameDetails> | null }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const infos = gameInfos(null, details).filter(i => PLAYER_KEYS.has(i.key))
  if (infos.length === 0) return null
  const best = infos.find(i => i.key === 'bestWith')
  return (
    <section className="prices-sec players-sec">
      <button type="button" className="prices-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(o => !o)}>
        <span aria-hidden="true">👥</span>
        Players
        {best && <span className="cat-now">Best {best.text.replace(/ players?$/, '')}</span>}
        <span className="chev" aria-hidden="true">
          ›
        </span>
      </button>
      <div className="prices-body" id={bodyId} hidden={!open}>
        {open && (
          <dl className="info-list">
            {infos.map(i => (
              <div key={i.key}>
                <dt>{i.label}</dt>
                <dd>{i.text}</dd>
              </div>
            ))}
            <PlayerPoll poll={details?.playerPoll} voters={details?.playerPollVoters} shown />
          </dl>
        )}
      </div>
    </section>
  )
}
