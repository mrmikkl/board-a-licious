import { useId, useState } from 'react'

import type { SearchResult } from '../../domain/bgg-search.ts'
import { AddToCollectionsSheet } from '../components/AddToCollectionsSheet.tsx'
import { GameInfoSheet } from '../components/GameInfoSheet.tsx'
import { Header } from '../components/Header.tsx'
import { IconSearch } from '../components/icons.tsx'
import { SearchResultRow } from '../components/SearchResultRow.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useBggSearch } from '../hooks/useBggSearch.ts'

/** The Search place's limit (FR-009). */
const LIMIT = 50

/**
 * F006 (docs/design.md "Search BoardGameGeek"): search BoardGameGeek by name. No action bar: the field
 * is the only search control. Without the server's token it says that search comes soon (FR-008).
 */
export function Search() {
  const { bggSearch } = useServices()
  return (
    <>
      <Header title="Search" />
      <main className="screen">{bggSearch ? <SearchBgg /> : <SearchSoon />}</main>
    </>
  )
}

function SearchSoon() {
  return (
    <>
      <div className="card soon-card">
        <h2 className="card-title">Searching all of BoardGameGeek comes soon</h2>
        <p className="card-sub">It needs official access to BoardGameGeek's data, which is on its way. Until then, add a game by pasting its link.</p>
      </div>
      <div className="form">
        <div>
          <label className="label" htmlFor="search-bgg">
            Search BoardGameGeek
          </label>
          <div className="field is-disabled">
            <IconSearch />
            <input id="search-bgg" type="search" placeholder="Game name" disabled />
          </div>
        </div>
      </div>
    </>
  )
}

/** Where the person already has a game: "in Essen 2026" or "in 2 collections". */
function useInCollections() {
  return useStoreData(async store => {
    const names = new Map((await store.collections()).filter(c => !c.deleted).map(c => [c.id, c.name]))
    const byGame = new Map<number, string[]>()
    for (const e of await store.allEntries()) {
      const name = names.get(e.collectionId)
      if (e.deleted || !name) continue
      byGame.set(e.bggId, [...(byGame.get(e.bggId) ?? []), name])
    }
    return byGame
  })
}
const inText = (names: string[] | undefined) => (!names?.length ? null : names.length === 1 ? `in ${names[0]}` : `in ${names.length} collections`)

function SearchBgg() {
  const fieldId = useId()
  const hintId = useId()
  const { state, games, change, searchNow, retry } = useBggSearch(LIMIT)
  const inCollections = useInCollections()
  const [sheet, setSheet] = useState<{ kind: 'info' | 'add'; result: SearchResult }>()

  const status =
    state.status === 'loading'
      ? state.waiting
        ? 'BoardGameGeek asks us to wait a moment… still searching'
        : 'Searching BoardGameGeek…'
      : state.status === 'short'
        ? 'Type at least 2 letters.'
        : state.status === 'long'
          ? 'At most 100 letters.'
          : state.status === 'done' && state.results.length > 0
            ? `${state.results.length} ${state.results.length === 1 ? 'game' : 'games'} · ${state.results.length === LIMIT ? 'the first 50, ' : ''}exact matches first`
            : ''
  const rows = state.status === 'done' ? state.results : state.status === 'loading' ? state.previous : null

  return (
    <>
      <label className="label" htmlFor={fieldId}>
        Search BoardGameGeek
      </label>
      <div className="field search">
        <IconSearch />
        <input
          id={fieldId}
          type="search"
          placeholder="Game name, e.g. Cascadia"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={100}
          autoFocus
          aria-describedby={hintId}
          value={state.text}
          onChange={e => change(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              searchNow()
            }
          }}
        />
      </div>
      <p className="search-hint" id={hintId}>
        Type at least 2 letters.
      </p>
      <hr className="separator" />
      <p className="result-status" role="status">
        {state.status === 'loading' && <span className="spin-hex" aria-hidden="true" />}
        {status}
      </p>
      {state.status === 'offline' && <Notice text="You're offline. Searching needs a connection." onRetry={retry} />}
      {state.status === 'unavailable' && <Notice text="BoardGameGeek is not reachable. Try again in a moment." onRetry={retry} />}
      {state.status === 'done' && state.results.length === 0 && (
        <div className="empty">
          <div className="hex" />
          <h2>No game called “{state.text.trim()}” on BoardGameGeek</h2>
          <p>Check the spelling, or try a shorter part of the name.</p>
        </div>
      )}
      {state.status === 'loading' && !rows && (
        <div className="rows" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="skel" />
          ))}
        </div>
      )}
      {rows && rows.length > 0 && (
        <ul className={state.status === 'loading' ? 'rows is-stale' : 'rows'} aria-busy={state.status === 'loading'}>
          {rows.map(result => (
            <li key={result.bggId} className="list-item">
              <SearchResultRow
                result={result}
                game={games.get(result.bggId)}
                inText={inText(inCollections?.get(result.bggId))}
                onOpen={() => setSheet({ kind: 'info', result })}
                onAdd={() => setSheet({ kind: 'add', result })}
              />
            </li>
          ))}
        </ul>
      )}
      {state.status === 'done' && state.results.length === LIMIT && <p className="more-note">More games match. Type more of the name to narrow it down.</p>}
      {sheet?.kind === 'info' && <GameInfoSheet result={sheet.result} game={games.get(sheet.result.bggId)} onClose={() => setSheet(undefined)} />}
      {sheet?.kind === 'add' && <AddToCollectionsSheet result={sheet.result} game={games.get(sheet.result.bggId)} onClose={() => setSheet(undefined)} />}
    </>
  )
}

function Notice({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="notice warn">
      <p>{text}</p>
      <button type="button" className="btn" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}
