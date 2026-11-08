import { useCallback } from 'react'

import type { StoredList } from '../../client/types.ts'
import { ActionBar, MainButton } from '../components/ActionBar.tsx'
import { Header } from '../components/Header.tsx'
import { IconPlus } from '../components/icons.tsx'
import { LoadListSheet } from '../components/LoadListSheet.tsx'
import { PlaceTabs, tabId } from '../components/PlaceTabs.tsx'
import { useStoreData } from '../context.tsx'
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
          <ActionBar main={<MainButton icon={<IconPlus />} label="Load a BGG list" href={href({ name: 'lists', tab: current, load: true })} />} />
        </>
      )}
      {load && <LoadListSheet lists={lists ?? []} onClose={close} />}
    </>
  )
}

/** Lists › Status lists: the person's BGG statuses (filled in by US1); for now the empty state. */
function StatusLists() {
  return (
    <div className="empty">
      <div className="hex" />
      <h2>What you own, wish for and want to play</h2>
      <p>Add your BoardGameGeek username in Config to see your BGG collection here.</p>
      <div className="actions">
        <a className="btn btn-primary" href={href({ name: 'config' })}>
          Add username in Config
        </a>
      </div>
    </div>
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
