import { useCallback } from 'react'

import type { StoredList } from '../../client/types.ts'
import { STATUS_KEYS, counts } from '../../domain/bgg-status.ts'
import { ActionBar, MainButton } from '../components/ActionBar.tsx'
import { Header } from '../components/Header.tsx'
import { IconPlus } from '../components/icons.tsx'
import { LoadListSheet } from '../components/LoadListSheet.tsx'
import { PlaceTabs, tabId } from '../components/PlaceTabs.tsx'
import { StatusListCard } from '../components/StatusListCard.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useBggCollection } from '../hooks/useBggCollection.ts'
import { loadedAgo } from '../loaded-ago.ts'
import { type ListsTab, href, navigate } from '../router.ts'

const EXAMPLE = 'boardgamegeek.com/geekpreview/93'

function progress(list: StoredList) {
  if (list.pageCount === 0) return 'Loaded on another device. Open it to load the games here.'
  if (list.loadedPages >= list.pageCount) return `${list.entries.length} ${list.entries.length === 1 ? 'game' : 'games'}`
  // pages load only while the list is open (constitution V), so the card says how to go on
  return `Loading ${list.loadedPages} of ${list.pageCount} pages. Open the list to load the rest.`
}

/**
 * F008 (docs/design.md "Places and tabs"): Lists with the tabs Status lists, Previews and Geeklists; without
 * a tab in the address it opens on the last used one. The main ＋ on every tab opens the Load a BGG list
 * sheet (`?load`); a loaded list opens and its card lands in the tab of its kind.
 */
export function Lists({ tab, load }: { tab?: ListsTab; load?: boolean }) {
  const last = useStoreData(store => store.metaOrDefault('lastTab'))
  const lists = useStoreData(async store => (await store.lists()).sort((a, b) => b.openedAt.localeCompare(a.openedAt)))
  const current = tab ?? last?.lists
  const close = useCallback(() => navigate({ name: 'lists', tab: current }, { replace: true }), [current])
  return (
    <>
      <Header title="Lists" />
      {current && (
        <>
          <PlaceTabs
            place="lists"
            label="Lists"
            current={current}
            tabs={[
              { key: 'status', label: 'Status lists', route: { name: 'lists', tab: 'status' } },
              { key: 'previews', label: 'Previews', route: { name: 'lists', tab: 'previews' } },
              { key: 'geeklists', label: 'Geeklists', route: { name: 'lists', tab: 'geeklists' } },
            ]}
          />
          <main className="screen" role="tabpanel" aria-labelledby={tabId('lists', current)}>
            {current === 'status' ? <StatusLists /> : <LoadedLists lists={lists?.filter(l => l.kind === (current === 'previews' ? 'preview' : 'geeklist'))} kind={current} />}
          </main>
          <ActionBar main={<MainButton icon={<IconPlus />} label="Load a BGG list" caption="Load list" href={href({ name: 'lists', tab: current, load: true })} />} />
        </>
      )}
      {load && <LoadListSheet lists={lists ?? []} onClose={close} />}
    </>
  )
}

/**
 * Lists › Status lists (FR-002, docs/design.md "Status list card"): the person's own status lists first,
 * then per friend loaded by link their read-only ones. Without a username: the empty state.
 */
function StatusLists() {
  const data = useStoreData(async store => {
    const username = await store.bggUsername()
    const own = username?.toLowerCase()
    return { username, friends: (await store.follows()).filter(f => f !== own) }
  })
  if (!data) return null
  const { username, friends } = data
  return (
    <>
      {username ? (
        <StatusGroup bggUser={username} own />
      ) : (
        <div className="empty">
          <div className="hex" />
          <h2>What you own, wish for and want to play</h2>
          <p>Add your BoardGameGeek username in Config to see your BGG collection here. A friend&apos;s list: paste the link to their BGG collection with the plus.</p>
          <div className="actions">
            <a className="btn btn-primary" href={href({ name: 'config' })}>
              Add username in Config
            </a>
          </div>
        </div>
      )}
      {friends.map(friend => (
        <StatusGroup key={friend} bggUser={friend} />
      ))}
    </>
  )
}

/** One person's status lists: a heading, then a card per status with games, or what keeps them from showing. */
function StatusGroup({ bggUser, own = false }: { bggUser: string; own?: boolean }) {
  const { store, sync } = useServices()
  const { collection, loading, preparing, problem, refresh } = useBggCollection(bggUser)
  const loaded = collection?.loadedAt && !collection.error ? collection : undefined
  const found = loaded ? counts(loaded.items) : undefined
  const shown = STATUS_KEYS.filter(key => (found?.[key] ?? 0) > 0)
  const offline = problem === 'offline' ? ' · offline' : ''
  const unfollow = async () => {
    await store.unfollow(bggUser)
    void sync.schedule()
  }
  return (
    <section aria-label={own ? 'Mine' : bggUser}>
      <h2 className="person">
        {own ? 'Mine' : bggUser}{' '}
        <small>
          {own ? `· ${bggUser} on BoardGameGeek · ${loaded ? loadedAgo(loaded.loadedAt, Date.now()) : 'not loaded yet'}${offline}` : `· loaded by link · read-only${offline}`}
        </small>
      </h2>
      {preparing ? (
        <p className="result-status" role="status">
          <span className="spin-hex" aria-hidden="true" />
          BoardGameGeek is preparing {own ? 'your' : 'this'} collection… it loads by itself when ready
        </p>
      ) : collection?.error ? (
        <p className="fail-line">
          <span>{collection.error === 'not_found' ? `No BoardGameGeek user called “${bggUser}”.` : `The BGG collection of ${bggUser} is private.`}</span>
          {own ? (
            <a className="btn" href={href({ name: 'config' })}>
              Change it in Config
            </a>
          ) : (
            <button type="button" className="btn" onClick={() => void unfollow()}>
              Remove
            </button>
          )}
        </p>
      ) : problem === 'unavailable' ? (
        <p className="fail-line">
          <span>BoardGameGeek is not reachable right now.</span>
          <button type="button" className="btn" onClick={refresh}>
            Try again
          </button>
        </p>
      ) : !loaded ? (
        <p className="result-status" role="status">
          {problem === 'offline' ? 'You’re offline. The lists load once you’re back online.' : loading ? 'Loading from BoardGameGeek…' : '\u00a0'}
        </p>
      ) : null}
      {loaded && shown.length === 0 && !preparing && <p className="lead">No games in this BGG collection yet.</p>}
      {shown.length > 0 && (
        <ul className="status-cards">
          {shown.map(key => (
            <li key={key}>
              <StatusListCard bggUser={bggUser} status={key} count={found![key]} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Lists › Previews or Geeklists: the BGG lists of that kind loaded on this device (FR-012), newest first. */
function LoadedLists({ lists, kind }: { lists?: StoredList[]; kind: 'previews' | 'geeklists' }) {
  if (!lists) return null
  if (lists.length === 0)
    return (
      <div className="empty">
        <div className="hex" />
        <h2>{kind === 'previews' ? 'No preview loaded yet' : 'No geeklist loaded yet'}</h2>
        <p>
          {kind === 'previews' ? (
            <>
              Tap + below and paste the link of a BoardGameGeek preview, for example the SPIEL preview: <span className="example">{EXAMPLE}</span>
            </>
          ) : (
            'Tap + below and paste the link of a BoardGameGeek geeklist.'
          )}
        </p>
      </div>
    )
  return (
    <>
      <p className="lead">Loaded lists stay on this phone for browsing, also offline. Open one to put its games into your shopping lists.</p>
      <div className="cards">
        {lists.map(list => (
          <a key={`${list.kind}:${list.id}`} className="card list-card" href={href({ name: 'list', kind: list.kind, listId: list.id })}>
            <span className="cluster" aria-hidden="true">
              <i className="hex" />
              <i className="hex" />
              <i className="hex" />
            </span>
            <h2 className="card-title">
              <span className="card-name">{list.title}</span>
            </h2>
            <p className="card-sub">{list.error ? `${list.error} Open the list to retry.` : progress(list)}</p>
            {list.loadedPages < list.pageCount && (
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${Math.round((100 * list.loadedPages) / list.pageCount)}%` }} />
              </div>
            )}
          </a>
        ))}
      </div>
    </>
  )
}
