import { useId } from 'react'

import { Header } from '../components/Header.tsx'
import { IconSearch } from '../components/icons.tsx'
import { SearchResultRow } from '../components/SearchResultRow.tsx'
import { useServices } from '../context.tsx'
import { useBggSearch } from '../hooks/useBggSearch.ts'
import { navigate } from '../router.ts'

const LIMIT = 50

/**
 * F007 (docs/design.md "Buy"): the menu's first place: find a game with feature 006's search and open
 * its prices. No action bar; result rows have no +.
 */
export function Buy() {
  const { bggSearch } = useServices()
  const fieldId = useId()
  const hintId = useId()
  const { state, games, change, searchNow, retry } = useBggSearch(LIMIT)
  const rows = state.status === 'done' ? state.results : state.status === 'loading' ? state.previous : null
  const status =
    state.status === 'loading'
      ? 'Searching BoardGameGeek…'
      : state.status === 'short'
        ? 'Type at least 2 letters.'
        : state.status === 'done' && state.results.length > 0
          ? `${state.results.length} ${state.results.length === 1 ? 'game' : 'games'} · exact matches first`
          : ''
  return (
    <>
      <Header title="Buy" />
      <main className="screen">
        <label className="label" htmlFor={fieldId}>
          Find a game's prices
        </label>
        <div className={bggSearch ? 'field search' : 'field search is-disabled'}>
          <IconSearch />
          <input
            id={fieldId}
            type="search"
            placeholder="Game name, e.g. Cascadia"
            autoComplete="off"
            enterKeyHint="search"
            maxLength={100}
            disabled={!bggSearch}
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
          {bggSearch ? 'Type at least 2 letters.' : "Searching needs BoardGameGeek access. Open a game's details in a collection and use Prices there."}
        </p>
        <hr className="separator" />
        <p className="result-status" role="status">
          {state.status === 'loading' && <span className="spin-hex" aria-hidden="true" />}
          {status}
        </p>
        {(state.status === 'offline' || state.status === 'unavailable') && (
          <div className="notice warn">
            <p>{state.status === 'offline' ? "You're offline. Searching needs a connection." : 'BoardGameGeek is not reachable. Try again in a moment.'}</p>
            <button type="button" className="btn" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {state.status === 'done' && state.results.length === 0 && (
          <div className="empty">
            <div className="hex" />
            <h2>No game called “{state.text.trim()}” on BoardGameGeek</h2>
            <p>Check the spelling, or try a shorter part of the name.</p>
          </div>
        )}
        {rows && rows.length > 0 && (
          <ul className={state.status === 'loading' ? 'rows is-stale' : 'rows'}>
            {rows.map(result => (
              <li key={result.bggId}>
                <SearchResultRow result={result} game={games.get(result.bggId)} onOpen={() => navigate({ name: 'prices', bggId: result.bggId })} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
