import { useCallback, useState } from 'react'

import type { Game } from '../../client/types.ts'
import { type Entry, showOffGames } from '../../domain/collection.ts'
import { type Mark, markInfo } from '../../domain/marks.ts'
import { Header } from '../components/Header.tsx'
import { ImageViewer } from '../components/ImageViewer.tsx'
import { useStoreData } from '../context.tsx'
import { href, navigate } from '../router.ts'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('') || '?'

/** Three hexagons per row; every other row is shifted by half a hexagon in CSS (research R8). */
function rows<T>(items: T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += 3) out.push(items.slice(i, i + 3))
  return out
}

/**
 * F004 US2 (FR-010–FR-014, docs/design.md "Show-off"): the honeycomb of the covers of the games in
 * the chosen groups, in collection group order and by name; a hexagon opens the image viewer. A view
 * only, from the data on the phone, so it works offline.
 */
export function ShowOff({ id, groups }: { id: string; groups: Mark[] }) {
  const [viewing, setViewing] = useState<Entry>()
  const closeViewer = useCallback(() => setViewing(undefined), [])
  const data = useStoreData(
    async store => {
      const collection = (await store.collections()).find(c => c.id === id && !c.deleted)
      const entries = await store.entries(id)
      const games = new Map((await store.games(entries.map(e => e.bggId))).map(g => [g.bggId, g]))
      return { id, collection, entries, games }
    },
    [id],
  )
  const back = href({ name: 'collection', id })
  if (!data || data.id !== id) return <Header title="Show-off" back={back} />
  const { collection, entries, games } = data
  if (!collection) {
    return (
      <>
        <Header title="Show-off" back={back} />
        <main className="screen">
          <div className="empty">
            <div className="hex" />
            <h2>This collection does not exist anymore</h2>
            <p>It may have been deleted on another device.</p>
            <div className="actions">
              <a className="btn btn-primary" href={href({ name: 'collections' })}>
                Go to your collections
              </a>
            </div>
          </div>
        </main>
      </>
    )
  }
  const nameOf = (e: Entry) => games.get(e.bggId)?.name ?? `Game ${e.bggId}`
  const shown = showOffGames(entries, groups, nameOf)
  const marks = groups.map(g => markInfo(g).emoji).join(' ')
  const viewed = viewing && games.get(viewing.bggId)
  return (
    <>
      <Header title="Show-off" back={back} />
      <p className="showoff-line">
        {collection.name} · {marks} · {shown.length} {shown.length === 1 ? 'game' : 'games'}
      </p>
      <main className="screen">
        {shown.length === 0 ? (
          <div className="empty">
            <div className="hex" />
            <h2>No game in these groups</h2>
            <p>Choose other groups to show off.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'collection', id, open: 'showoff' })}>
                Choose groups
              </button>
            </div>
          </div>
        ) : (
          <div className="honeycomb">
            {rows(shown).map((row, r) => (
              <div key={r} className="honeycomb-row">
                {row.map(entry => (
                  <Hexagon key={entry.bggId} entry={entry} game={games.get(entry.bggId)} name={nameOf(entry)} onOpen={() => setViewing(entry)} />
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
      {viewing && (
        <ImageViewer
          game={{ bggId: viewing.bggId, name: nameOf(viewing) }}
          cover={viewed?.thumbnailUrl ?? null}
          pending={viewing.detailsPending && !viewed?.thumbnailUrl}
          onClose={closeViewer}
        />
      )}
    </>
  )
}

/** One cover as a hexagon button: lazy cover or initials, the ✓ badge when bought; named "<game>, <mark>" (FR-011). */
function Hexagon({ entry, game, name, onOpen }: { entry: Entry; game?: Game; name: string; onOpen: () => void }) {
  const [failed, setFailed] = useState<string | null>(null)
  const url = entry.detailsPending ? null : game?.thumbnailUrl
  const src = url && url !== failed ? url : null
  return (
    <button type="button" className="honeycomb-cell hex" aria-label={`${name}, ${markInfo(entry.mark).label}`} title={name} onClick={onOpen}>
      {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : <span className="honeycomb-initials">{initials(name)}</span>}
      {entry.bought && <span className="honeycomb-got">✓</span>}
    </button>
  )
}
