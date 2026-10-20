import { useCallback } from 'react'

import type { StoredList } from '../../client/types.ts'
import { ActionBar, MainButton } from '../components/ActionBar.tsx'
import { Header } from '../components/Header.tsx'
import { IconPlus } from '../components/icons.tsx'
import { LoadListSheet } from '../components/LoadListSheet.tsx'
import { useStoreData } from '../context.tsx'
import { href, navigate } from '../router.ts'

const EXAMPLE = 'boardgamegeek.com/geekpreview/93'

function progress(list: StoredList) {
  if (list.pageCount === 0) return 'Loaded on another device. Open it to load the games here.'
  if (list.loadedPages >= list.pageCount) return `${list.entries.length} ${list.entries.length === 1 ? 'game' : 'games'}`
  // pages load only while the list is open (constitution V), so the card says how to go on
  return `Loading ${list.loadedPages} of ${list.pageCount} pages. Open the list to load the rest.`
}

/** BGG lists loaded on this device (FR-012), newest first; the main ＋ opens the Load a BGG list sheet (`#/lists?load`). */
export function Lists({ load }: { load?: boolean }) {
  const lists = useStoreData(async store => (await store.lists()).sort((a, b) => b.openedAt.localeCompare(a.openedAt)))
  const close = useCallback(() => navigate({ name: 'lists' }, { replace: true }), [])
  return (
    <>
      <Header title="BGG lists" />
      <main className="screen">
        {lists && lists.length === 0 && (
          <div className="empty">
            <div className="hex" />
            <h2>No BGG list loaded yet</h2>
            <p>
              Tap + below and paste the link of a BoardGameGeek preview or geeklist, for example the SPIEL preview: <span className="example">{EXAMPLE}</span>
            </p>
          </div>
        )}
        {lists && lists.length > 0 && (
          <>
            <p className="lead">Loaded lists stay on this phone for browsing, also offline. Open one to put its games into your collections.</p>
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
        )}
      </main>
      <ActionBar main={<MainButton icon={<IconPlus />} label="Load a BGG list" href={href({ name: 'lists', load: true })} />} />
      {load && <LoadListSheet lists={lists ?? []} onClose={close} />}
    </>
  )
}
