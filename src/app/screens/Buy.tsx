import { useEffect, useId, useState } from 'react'

import type { Game } from '../../client/types.ts'
import type { SearchResult } from '../../domain/bgg-search.ts'
import { inText } from '../../domain/membership.ts'
import { AddToCollectionsSheet } from '../components/AddToCollectionsSheet.tsx'
import { GameSheet } from '../components/GameSheet.tsx'
import { Header } from '../components/Header.tsx'
import { IconSearch } from '../components/icons.tsx'
import { ListGameRow } from '../components/ListGameRow.tsx'
import { PlaceTabs, tabId } from '../components/PlaceTabs.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useBggSearch } from '../hooks/useBggSearch.ts'
import { navigate } from '../router.ts'
import { Collections } from './Collections.tsx'

/** The search's limit (F006 FR-009). */
const LIMIT = 50

/**
 * F008 (docs/design.md "Buy"): the menu's first place with the tabs Search (find any game on
 * BoardGameGeek; a result opens the game sheet) and Shopping lists (the person's collections).
 */
export function Buy({ tab, game, create }: { tab: 'search' | 'shopping'; game?: number; create?: boolean }) {
  return (
    <>
      <Header title="Buy" />
      <PlaceTabs
        place="buy"
        label="Buy"
        current={tab}
        tabs={[
          { key: 'search', label: 'Search', route: { name: 'buy' } },
          { key: 'shopping', label: 'Shopping lists', route: { name: 'collections' } },
        ]}
      />
      {tab === 'search' ? <Search game={game} /> : <Collections create={create} />}
    </>
  )
}

/** Where the person already has each game: the names of its shopping lists. */
function useListNames() {
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

/**
 * Buy › Search (F006 search, docs/design.md "Search BoardGameGeek"): the field is the only control, no
 * action bar. Results are list game rows; `game` (`#/buy?game=`) opens a game's sheet.
 */
function Search({ game: openId }: { game?: number }) {
  const { bggSearch } = useServices()
  const fieldId = useId()
  const hintId = useId()
  const { state, games, change, loadGame, searchNow, retry } = useBggSearch(LIMIT)
  const listNames = useListNames()
  const [adding, setAdding] = useState<SearchResult>()
  // a game opened by its address may be on the device already
  const stored = useStoreData(async s => (openId ? s.game(openId) : undefined), [openId])
  useEffect(() => {
    if (openId) void loadGame(openId)
  }, [openId, loadGame])

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
  // the sheet's address loads the game's details (below)
  const open = (result: SearchResult) => navigate({ name: 'buy', game: result.bggId })
  const opened = openId ? sheetItem(openId, rows?.find(r => r.bggId === openId), games.get(openId) ?? stored ?? undefined) : undefined

  return (
    <main className="screen" role="tabpanel" aria-labelledby={tabId('buy', 'search')}>
      <label className="label" htmlFor={fieldId}>
        Find a game
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
        {bggSearch ? 'Type at least 2 letters.' : 'Searching all of BoardGameGeek needs official access, which is on its way. Until then, add a game to a shopping list by its link.'}
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
          {rows.map(result => {
            const game = games.get(result.bggId)
            return (
              <li key={result.bggId}>
                <ListGameRow
                  bggId={result.bggId}
                  // the details bring BGG's primary name where the search matched another one (F006 research R5)
                  name={game?.name || result.name}
                  year={result.year}
                  expansion={result.kind === 'expansion'}
                  game={game}
                  inText={inText(listNames?.get(result.bggId) ?? [])}
                  onOpen={() => open(result)}
                  onAdd={() => {
                    void loadGame(result.bggId)
                    setAdding(result)
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
      {state.status === 'done' && state.results.length === LIMIT && <p className="more-note">More games match. Type more of the name to narrow it down.</p>}
      {opened && (
        <GameSheet context="browse" item={opened.item} game={opened.game} onClose={() => navigate({ name: 'buy' }, { replace: true })} />
      )}
      {adding && (
        <AddToCollectionsSheet
          item={{ bggId: adding.bggId, name: adding.name, year: adding.year, kind: adding.kind, thumbnailUrl: null }}
          game={games.get(adding.bggId)}
          onClose={() => setAdding(undefined)}
        />
      )}
    </main>
  )
}

/** What the game sheet of Buy › Search shows: the search result, or the game as far as it is known. */
function sheetItem(bggId: number, result: SearchResult | undefined, game: Game | undefined) {
  const name = game?.name || result?.name
  if (!name) return undefined
  return { item: { bggId, name, year: result?.year ?? game?.year ?? null, kind: result?.kind ?? game?.kind, thumbnailUrl: game?.thumbnailUrl ?? null }, game }
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
