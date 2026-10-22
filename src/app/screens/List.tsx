import { useCallback, useEffect, useId, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import { LIST_ERROR } from '../../client/lists.ts'
import type { ListKind, StoredList, StoredListEntry } from '../../client/types.ts'
import { matchesName } from '../../domain/search.ts'
import { InfoLine } from '../components/GameInfo.tsx'
import { Header } from '../components/Header.tsx'
import { HexCover } from '../components/HexCover.tsx'
import { MembershipSheet } from '../components/MembershipSheet.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { href } from '../router.ts'

/** Pages loaded so far, or the paused state with Retry (FR-012). */
export function ListProgress({ list, onRetry }: { list: StoredList; onRetry: () => void }) {
  if (list.error) {
    return (
      <p className="list-status error" role="status">
        {list.error}{' '}
        <button type="button" className="btn" onClick={onRetry}>
          Retry
        </button>
      </p>
    )
  }
  if (list.loadedPages >= list.pageCount) return null
  return (
    <div className="list-status" role="status">
      <p>
        Loading {list.loadedPages} of {list.pageCount} pages
      </p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.round((100 * list.loadedPages) / list.pageCount)}%` }} />
      </div>
    </div>
  )
}

/**
 * A loaded BGG list (FR-013): name filter, rows with facts (Essen lists) and "in a collection", + per
 * row. Opening the screen lets the loader fetch further pages; leaving it pauses them.
 */
export function List({ kind, listId }: { kind: ListKind; listId: number }) {
  const services = useServices()
  const filterId = useId()
  const [failure, setFailure] = useState<ApiError>()
  const [attempt, setAttempt] = useState(0)
  const [filter, setFilter] = useState('')
  const [openGame, setOpenGame] = useState<number>()
  const closeGame = useCallback(() => setOpenGame(undefined), [])

  useEffect(() => {
    let active = true
    let opened = false
    setFailure(undefined)
    services.lists.open(kind, listId).then(
      () => {
        opened = true
        if (!active) services.lists.close(kind, listId)
      },
      (error: unknown) => {
        if (active) setFailure(error instanceof ApiError ? error : new ApiError('internal', LIST_ERROR, true))
      },
    )
    return () => {
      active = false
      if (opened) services.lists.close(kind, listId)
    }
  }, [services, kind, listId, attempt])

  const data = useStoreData(
    async store => {
      const list = await store.list(kind, listId)
      const inCollection = new Set((await store.allEntries()).filter(e => !e.deleted).map(e => e.bggId))
      return { key: `${kind}:${listId}`, list, inCollection }
    },
    [kind, listId],
  )
  const back = href({ name: 'lists' })
  const list = data?.key === `${kind}:${listId}` ? data.list : undefined

  if (!list) {
    return (
      <>
        <Header title="BGG list" back={back} />
        <main className="screen">
          {failure ? <OpenFailure error={failure} onRetry={() => setAttempt(n => n + 1)} /> : <p className="lead">Loading the first games from BoardGameGeek…</p>}
        </main>
      </>
    )
  }

  const shown = list.entries.filter(e => matchesName(e.name, filter))
  const current = list.entries.find(e => e.bggId === openGame)
  return (
    <>
      <Header title={list.title} back={back} />
      <main className="screen">
        <ListProgress list={list} onRetry={() => void services.lists.retry(kind, listId)} />
        <label className="visually-hidden" htmlFor={filterId}>
          Filter this list
        </label>
        <div className="field">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input id={filterId} type="search" value={filter} placeholder="Filter by name" autoComplete="off" onChange={e => setFilter(e.target.value)} />
        </div>
        <hr className="separator" />
        {shown.length === 0 ? (
          <p className="lead">{filter.trim() ? 'No game on this list matches.' : 'This list has no games yet.'}</p>
        ) : (
          <ul className="rows">
            {shown.map(entry => (
              <li key={entry.bggId} className="list-item">
                <ListRow entry={entry} inCollection={data!.inCollection.has(entry.bggId)} onOpen={() => setOpenGame(entry.bggId)} />
              </li>
            ))}
          </ul>
        )}
      </main>
      {current && <MembershipSheet list={list} item={current} onClose={closeGame} />}
    </>
  )
}

/** A list game like a collection row: name, publisher ("…" while its name is looked up), three infos. */
function ListRow({ entry, inCollection, onOpen }: { entry: StoredListEntry; inCollection: boolean; onOpen: () => void }) {
  const sub = entry.facts?.publisher ?? (entry.facts?.publisherId != null ? '…' : null)
  return (
    <>
      <button type="button" className="row" onClick={onOpen}>
        <HexCover game={{ ...entry, year: null, description: null, kind: 'boardgame' }} name={entry.name} />
        <span className="row-meta">
          <span className="row-name">{entry.name}</span>
          {sub && <span className="row-sub">{sub}</span>}
          <InfoLine facts={entry.facts} details={entry.info} />
          {inCollection && <span className="in-mark">in a collection</span>}
        </span>
      </button>
      <button type="button" className="add-mini hex-btn" aria-label={`Add ${entry.name} to a collection`} onClick={onOpen}>
        <span className="hex" aria-hidden="true">
          +
        </span>
      </button>
    </>
  )
}

/** Page 1 could not be loaded: the list does not exist, or BGG or the connection is down. */
function OpenFailure({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const missing = error.code === 'not_found'
  return (
    <div className="empty">
      <div className="hex" />
      <h2>{missing ? 'This list does not exist on BoardGameGeek' : LIST_ERROR}</h2>
      <p>{missing ? 'Check the link and load the list again.' : error.code === 'offline' ? 'You are offline. Connect and try again.' : 'Try again in a moment.'}</p>
      <div className="actions">
        {missing ? (
          <a className="btn btn-primary" href={href({ name: 'lists', load: true })}>
            Load a BGG list
          </a>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
