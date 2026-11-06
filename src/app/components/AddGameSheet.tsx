import { type FormEvent, useEffect, useId, useState } from 'react'

import type { Game } from '../../client/types.ts'
import { type SearchResult, parseGameInput } from '../../domain/bgg-search.ts'
import type { Collection } from '../../domain/collection.ts'
import type { Mark } from '../../domain/marks.ts'
import { addGameByLink } from '../actions.ts'
import { useServices } from '../context.tsx'
import { useBggSearch } from '../hooks/useBggSearch.ts'
import { CategoryPicker } from './CategoryPicker.tsx'
import { HexCover } from './HexCover.tsx'
import { IconSearch } from './icons.tsx'
import { SearchResultRow, yearText } from './SearchResultRow.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

/** Matches shown under the field (FR-013). */
const MATCHES = 8

type Found = { bggId: number; name: string; result?: SearchResult; game?: Game }

/**
 * "Add game" (FR-016, F006 US3): one field for a game's name or its BoardGameGeek link. A name lists up
 * to 8 matches; picking one, or a recognised link, shows the Found game card with the editable name.
 */
export function AddGameSheet({ collection, inside, onClose }: { collection: Collection; inside: Set<number>; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const fieldId = useId()
  const nameId = useId()
  const hintId = useId()
  const [text, setText] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  // F005: optional; tapping the chosen one again means No category yet
  const [mark, setMark] = useState<Mark>('new')
  const search = useBggSearch(MATCHES)
  const input = parseGameInput(text)
  const linkError = input.kind === 'link' && !input.link.ok ? input.link.message : null
  const already = Boolean(found && inside.has(found.bggId))
  const ready = Boolean(found && name.trim() && !already && !busy)

  // the cover and year of a game found by its link
  const foundId = found && !found.game ? found.bggId : null
  useEffect(() => {
    if (foundId === null) return
    let active = true
    services.api.games([foundId]).then(
      ([game]) => active && game && setFound(f => (f?.bggId === foundId ? { ...f, game } : f)),
      () => {},
    )
    return () => {
      active = false
    }
  }, [services, foundId])

  const type = (value: string) => {
    setText(value)
    const next = parseGameInput(value)
    if (next.kind === 'link' && next.link.ok) {
      search.change('')
      setFound({ bggId: next.link.bggId, name: next.link.suggestedName })
      setName(next.link.suggestedName)
    } else {
      search.change(next.kind === 'name' && services.bggSearch ? value : '')
    }
  }
  const pick = (result: SearchResult) => {
    const game = search.games.get(result.bggId)
    const picked = game?.name || result.name
    setFound({ bggId: result.bggId, name: picked, result, game })
    setName(picked)
  }
  const change = () => {
    setFound(null)
    setText('')
    search.change('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !found) return
    setBusy(true)
    try {
      if (found.game) await services.store.putGames([found.game])
      await addGameByLink(services, collection.id, found.bggId, name, mark)
      toast(`Added ${name.trim()} to ${collection.name}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const s = search.state
  return (
    <Sheet open title="Add game" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="lead">Type a game's name, or paste its link from boardgamegeek.com.</p>
        {found ? (
          <div>
            <h2 className="section-title">
              Found game <small>ID {found.bggId}</small>
            </h2>
            <div className="found">
              <HexCover game={found.game} name={found.name} size={48} />
              <span className="row-meta">
                <span className="row-name">{found.game?.name || found.name}</span>
                <span className="row-sub">
                  {yearText(found.game?.year ?? found.result?.year)}
                  {(found.game?.kind ?? found.result?.kind) === 'expansion' && <span className="kind-pill">Expansion</span>}
                </span>
              </span>
              <button type="button" className="link-btn" onClick={change}>
                Change
              </button>
            </div>
            <label className="label" htmlFor={nameId}>
              Name
            </label>
            <div className="field">
              <input id={nameId} value={name} autoComplete="off" onChange={e => setName(e.target.value)} />
            </div>
            <p className="hint">Year, cover and details are filled in from BoardGameGeek.</p>
            {already && <p className="hint error">This game is already in {collection.name}.</p>}
          </div>
        ) : (
          <div>
            <label className="label" htmlFor={fieldId}>
              Game name or BoardGameGeek link
            </label>
            <div className="field search">
              <IconSearch />
              <input
                id={fieldId}
                type="search"
                autoComplete="off"
                placeholder="Harmonies, or boardgamegeek.com/boardgame/…"
                value={text}
                aria-describedby={hintId}
                aria-invalid={linkError ? true : undefined}
                onChange={e => type(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (input.kind === 'name') search.searchNow()
                  }
                }}
              />
            </div>
            <div id={hintId}>
              {linkError && <p className="hint error">{linkError}</p>}
              {input.kind === 'name' && !services.bggSearch && <p className="hint">Searching by name needs BoardGameGeek access; paste the game's link instead.</p>}
              {input.kind === 'name' && services.bggSearch && <MatchStatus state={s} onRetry={search.retry} />}
            </div>
            {s.status === 'done' && s.results.length > 0 && (
              <ul className="matches" aria-label="Matching games">
                {s.results.map(result => (
                  <li key={result.bggId}>
                    <SearchResultRow compact result={result} game={search.games.get(result.bggId)} onOpen={() => pick(result)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <p className="label">Category (optional)</p>
        <CategoryPicker value={mark} onPick={key => setMark(m => (m === key ? 'new' : key))} />
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            Add to collection
          </button>
        </div>
      </form>
    </Sheet>
  )
}

/** One line under the field: what the name search is doing (docs/design.md "Add game"). */
function MatchStatus({ state, onRetry }: { state: ReturnType<typeof useBggSearch>['state']; onRetry: () => void }) {
  const line =
    state.status === 'short'
      ? 'Type at least 2 letters.'
      : state.status === 'long'
        ? 'At most 100 letters.'
        : state.status === 'loading'
          ? state.waiting
            ? 'BoardGameGeek asks us to wait…'
            : 'Searching BoardGameGeek…'
          : state.status === 'done'
            ? state.results.length === 0
              ? `No game called “${state.text.trim()}” on BoardGameGeek.`
              : `${state.results.length} ${state.results.length === 1 ? 'match' : 'matches'}`
            : null
  if (state.status === 'offline' || state.status === 'unavailable') {
    return (
      <p className="hint error">
        {state.status === 'offline' ? "You're offline. Paste a link instead, or " : 'BoardGameGeek is not reachable. '}
        <button type="button" className="link-btn" onClick={onRetry}>
          {state.status === 'offline' ? 'try again' : 'Try again'}
        </button>
        {state.status === 'offline' ? '.' : ''}
      </p>
    )
  }
  return line ? (
    <p className={state.status === 'done' && state.results.length > 0 ? 'visually-hidden' : 'hint'} role="status">
      {line}
    </p>
  ) : null
}
