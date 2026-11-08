import { useCallback, useEffect, useId, useState } from 'react'

import type { Game } from '../../client/types.ts'

import { type BggCollectionItem, PRIORITY_NAMES, STATUS_NAMES, type StatusKey, type WishlistPriority, statusList } from '../../domain/bgg-status.ts'
import { inText } from '../../domain/membership.ts'
import { matchesName } from '../../domain/search.ts'
import { ActionBar, MainButton } from '../components/ActionBar.tsx'
import { AddToCollectionsSheet } from '../components/AddToCollectionsSheet.tsx'
import { AddToStatusSheet } from '../components/AddToStatusSheet.tsx'
import { colourOf, useBgg } from '../components/BggBadges.tsx'
import { GameSheet } from '../components/GameSheet.tsx'
import { Header } from '../components/Header.tsx'
import { IconPlus, IconResync } from '../components/icons.tsx'
import { ListGameRow } from '../components/ListGameRow.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useBggCollection } from '../hooks/useBggCollection.ts'
import { loadedAgo } from '../loaded-ago.ts'
import { href } from '../router.ts'

const PRIORITIES: WishlistPriority[] = [1, 2, 3, 4, 5]

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
 * F008 (docs/design.md "Status list", FR-003–FR-007): one BGG status list of the person or of a friend
 * (read-only), like a BGG list: list game rows that open the game sheet, Add to shopping lists; the
 * Wishlist grouped by priority. Read again from BGG asks BGG afresh; while BGG prepares the collection
 * the list says so and loads by itself; offline it shows the stored copy with its time.
 */
export function StatusList({ bggUser, status }: { bggUser: string; status: StatusKey }) {
  const username = useStoreData(store => store.bggUsername())
  const own = username === undefined || username?.toLowerCase() === bggUser.toLowerCase()
  const { collection, loading, preparing, problem, refresh } = useBggCollection(bggUser)
  const { colours } = useBgg()
  const listNames = useListNames()
  const [openGame, setOpenGame] = useState<{ kind: 'sheet' | 'add'; item: BggCollectionItem }>()
  const closeGame = useCallback(() => setOpenGame(undefined), [])
  const filterId = useId()
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const services = useServices()
  // the opened game's details: from the device, else from BGG (a failure leaves "Loading the details…")
  const [details, setDetails] = useState<Game>()
  const openedId = openGame?.kind === 'sheet' ? openGame.item.bggId : undefined
  useEffect(() => {
    if (openedId === undefined) return
    let live = true
    setDetails(undefined)
    void (async () => {
      const stored = await services.store.game(openedId)
      const game = stored ?? (await services.api.games([openedId]).catch(() => []))[0]
      if (!live || !game) return
      setDetails(game)
      if (!stored) await services.store.putGames([game])
    })()
    return () => {
      live = false
    }
  }, [openedId, services])

  const name = STATUS_NAMES[status]
  const loaded = collection?.loadedAt && !collection.error ? collection : undefined
  const all = loaded ? statusList(loaded.items, status) : []
  const items = all.filter(item => matchesName(item.name, filter))
  const source = [
    `${bggUser} on BoardGameGeek`,
    !own && 'read-only',
    loaded && loadedAgo(loaded.loadedAt, Date.now()),
    problem === 'offline' && 'offline',
  ]
    .filter(Boolean)
    .join(' · ')

  const row = (item: BggCollectionItem) => (
    <li key={item.bggId}>
      <ListGameRow
        name={item.name}
        year={item.year}
        expansion={item.kind === 'expansion'}
        cover={item}
        inText={inText(listNames?.get(item.bggId) ?? [])}
        onOpen={() => setOpenGame({ kind: 'sheet', item })}
        onAdd={() => setOpenGame({ kind: 'add', item })}
      />
    </li>
  )

  let body
  if (preparing || (!loaded && loading)) {
    body = (
      <>
        <p className="result-status" role="status">
          <span className="spin-hex" aria-hidden="true" />
          {preparing ? 'BoardGameGeek is preparing your collection… it loads by itself when ready' : 'Loading from BoardGameGeek…'}
        </p>
        <div className="skel-rows" aria-hidden="true">
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
          <div className="skel" />
        </div>
      </>
    )
  } else if (collection?.error) {
    body = (
      <div className="empty">
        <div className="hex" />
        <h2>{collection.error === 'not_found' ? `No BoardGameGeek user called “${bggUser}”` : `The BGG collection of ${bggUser} is private`}</h2>
        {own ? (
          <>
            <p>Check your BGG username in Config.</p>
            <div className="actions">
              <a className="btn btn-primary" href={href({ name: 'config' })}>
                Change it in Config
              </a>
            </div>
          </>
        ) : (
          <p>Check the link and load it again.</p>
        )}
      </div>
    )
  } else if (!loaded) {
    body = (
      <div className="empty">
        <div className="hex" />
        <h2>{problem === 'offline' ? 'You’re offline' : 'BoardGameGeek did not answer'}</h2>
        <p>{problem === 'offline' ? 'This list loads once you’re back online.' : 'Try again in a moment.'}</p>
        {problem !== 'offline' && (
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={refresh}>
              Try again
            </button>
          </div>
        )}
      </div>
    )
  } else if (items.length === 0) {
    body = <p className="lead">{all.length > 0 ? 'No game on this list matches.' : 'No games on this list.'}</p>
  } else if (status === 'wishlist') {
    body = PRIORITIES.map(priority => {
      const games = items.filter(item => item.status.wishlist === priority)
      if (games.length === 0) return null
      return (
        <section key={priority} className="status-group" aria-label={`${priority} ${PRIORITY_NAMES[priority]}`}>
          <h2>
            <i {...colourOf(colours, 'wishlist')} aria-hidden="true" />
            {priority} {PRIORITY_NAMES[priority]} <span className="group-count">{games.length}</span>
          </h2>
          <ul className="rows">{games.map(row)}</ul>
        </section>
      )
    })
  } else {
    body = <ul className="rows">{items.map(row)}</ul>
  }

  const current = openGame?.item
  const item = current && { bggId: current.bggId, name: current.name, thumbnailUrl: current.thumbnailUrl, year: current.year, kind: current.kind }
  return (
    <>
      <Header
        title={own ? name : `${bggUser}: ${name}`}
        back={href({ name: 'lists', tab: 'status' })}
        trailing={
          <button
            type="button"
            className={`icon-btn resync-btn${loading ? ' is-spinning' : ''}`}
            aria-label="Read again from BGG"
            title="Read again from BGG"
            disabled={loading}
            onClick={refresh}
          >
            <IconResync />
          </button>
        }
      />
      <main className="screen">
        <p className="list-sub">{source}</p>
        {loaded && problem === 'unavailable' && (
          <p className="fail-line">
            <span>BoardGameGeek did not answer. This is the copy from before.</span>
            <button type="button" className="btn" onClick={refresh}>
              Try again
            </button>
          </p>
        )}
        {all.length > 0 && (
          <>
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
          </>
        )}
        <hr className="separator" />
        {body}
      </main>
      {own && <ActionBar main={<MainButton icon={<IconPlus />} label={`Add a game to ${name}`} onClick={() => setAdding(true)} />} />}
      {adding && <AddToStatusSheet status={status} onClose={() => setAdding(false)} />}
      {item && openGame.kind === 'sheet' && <GameSheet context="browse" item={item} game={details?.bggId === item.bggId ? details : undefined} onClose={closeGame} />}
      {item && openGame.kind === 'add' && <AddToCollectionsSheet item={item} onClose={closeGame} />}
    </>
  )
}
