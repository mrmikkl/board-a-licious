import type { StoredList } from '../../client/types.ts'
import { Header } from '../components/Header.tsx'
import { useStoreData } from '../context.tsx'
import { href } from '../router.ts'

const EXAMPLE = 'boardgamegeek.com/geekpreview/93'

function progress(list: StoredList) {
  if (list.pageCount === 0) return 'Loaded on another device. Open it to load the games here.'
  if (list.loadedPages >= list.pageCount) return `${list.entries.length} ${list.entries.length === 1 ? 'game' : 'games'}`
  // pages load only while the list is open (constitution V), so the card says how to go on
  return `Loading ${list.loadedPages} of ${list.pageCount} pages. Open the list to load the rest.`
}

/** BGG lists loaded on this device (FR-012), newest first, and the "Load a BGG list" card. */
export function Lists() {
  const lists = useStoreData(async store => (await store.lists()).sort((a, b) => b.openedAt.localeCompare(a.openedAt)))
  const load = href({ name: 'add', what: 'list' })
  return (
    <>
      <Header title="BGG lists" />
      <main className="screen">
        {lists && lists.length === 0 && (
          <div className="empty">
            <div className="hex" />
            <h2>No BGG list loaded yet</h2>
            <p>
              Load a BoardGameGeek preview or geeklist by its link, for example the SPIEL preview: <span className="example">{EXAMPLE}</span>
            </p>
            <div className="actions">
              <a className="btn btn-primary" href={load}>
                Load a BGG list
              </a>
            </div>
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
              <a className="card new-card" href={load}>
                <span className="hex" aria-hidden="true" />
                Load a BGG list
              </a>
            </div>
          </>
        )}
      </main>
    </>
  )
}
