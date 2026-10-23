import { useCallback, useEffect, useId, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import { LIST_ERROR, RESYNC_BUSY } from '../../client/lists.ts'
import type { ListKind, StoredList, StoredListEntry } from '../../client/types.ts'
import type { Conflict } from '../../domain/facts.ts'
import { matchesName } from '../../domain/search.ts'
import { ConflictsSheet } from '../components/ConflictsSheet.tsx'
import { InfoLine } from '../components/GameInfo.tsx'
import { Header } from '../components/Header.tsx'
import { HexCover } from '../components/HexCover.tsx'
import { IconResync } from '../components/icons.tsx'
import { MembershipSheet } from '../components/MembershipSheet.tsx'
import { useToast } from '../components/Toast.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { href } from '../router.ts'

/** Pages loaded so far, or the paused state with Retry (FR-012); during a resync, its progress (US5). */
export function ListProgress({ list, onRetry, resyncing = false }: { list: StoredList; onRetry: () => void; resyncing?: boolean }) {
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
  if (!resyncing && list.loadedPages >= list.pageCount) return null
  return (
    <div className="list-status" role="status">
      <p>{resyncing ? `Resyncing with BGG… ${list.loadedPages} / ${list.pageCount}` : `Loading ${list.loadedPages} of ${list.pageCount} pages`}</p>
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
  const online = useOnline()
  const toast = useToast()
  const [resyncing, setResyncing] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])

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
      const collections = new Map((await store.collections()).map(c => [c.id, c.name]))
      return { key: `${kind}:${listId}`, list, inCollection, collections }
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
  // US5: read the list again from BGG, then reconcile the games' facts; a busy BGG changes nothing
  const runResync = async () => {
    setResyncing(true)
    try {
      const result = await services.lists.resync(kind, listId)
      const games = `${result.updated} ${result.updated === 1 ? 'game' : 'games'} updated`
      const found = result.conflicts.length > 0 ? `, ${result.conflicts.length} ${result.conflicts.length === 1 ? 'conflict' : 'conflicts'}` : ''
      toast(`Resync done: ${games}${found}`)
      if (result.conflicts.length > 0) setConflicts(result.conflicts)
    } catch {
      toast(RESYNC_BUSY)
    } finally {
      setResyncing(false)
    }
  }
  const names = new Map(list.entries.map(e => [e.bggId, e.name]))
  return (
    <>
      <Header
        title={list.title}
        back={back}
        trailing={
          <button
            type="button"
            className={`icon-btn resync-btn${resyncing ? ' is-spinning' : ''}`}
            aria-label="Resync with BGG"
            title="Resync with BGG"
            disabled={!online || resyncing}
            onClick={() => void runResync()}
          >
            <IconResync />
          </button>
        }
      />
      <main className="screen">
        <ListProgress list={list} resyncing={resyncing} onRetry={() => void services.lists.retry(kind, listId)} />
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
      {conflicts.length > 0 && <ConflictsSheet conflicts={conflicts} names={names} collections={data!.collections} onClose={() => setConflicts([])} />}
    </>
  )
}

/** Whether the device is online; the Resync button waits for it (US5). */
function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
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
