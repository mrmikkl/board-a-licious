import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '../../client/api.ts'
import { LIST_ERROR } from '../../client/lists.ts'
import type { Game, StoredListEntry } from '../../client/types.ts'
import { STATUS_NAMES } from '../../domain/bgg-status.ts'
import { rowInfos } from '../../domain/game-info.ts'
import { type SwipeDirection, statusSwipeList, swipeQueue } from '../../domain/swipe.ts'
import { Header } from '../components/Header.tsx'
import { ListPicker } from '../components/ListPicker.tsx'
import { SwipeCard } from '../components/SwipeCard.tsx'
import { useServices, useStoreData } from '../context.tsx'
import { useBggCollection } from '../hooks/useBggCollection.ts'
import { type SwipeSource, href, navigate } from '../router.ts'
import { decideSwipe, loadCardDetails } from '../swipe-actions.ts'

/** Cards ahead whose year and description are fetched. */
const AHEAD = 5
const FLING_MS = 380

const gamesLeft = (n: number) => `${n} ${n === 1 ? 'game' : 'games'} left`

function useReducedMotion() {
  const query = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
  const [reduced, setReduced] = useState(query?.matches ?? false)
  useEffect(() => {
    if (!query) return
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return reduced
}

type Leaving = { game: StoredListEntry; details?: Game; direction: SwipeDirection; fromX: number; key: number }

/** What is swiped: a loaded BGG list, or (F008) a status list made from a stored BGG collection. */
type Swipeable = { title: string; error?: string; loadedPages: number; pageCount: number; entries: StoredListEntry[]; retry?: () => void }

const sourceKey = (source: SwipeSource | null) => (!source ? '' : source.kind === 'status' ? `status:${source.bggUser}:${source.status}` : `${source.kind}:${source.id}`)

/**
 * Swipe (FR-015): pick a list, then decide card by card; right adds the game with No category yet, left
 * as Not interested. Games already in the collection never come up. The list is open (loading its
 * pages) while this screen shows it.
 */
export function Swipe({ id, list: chosen }: { id: string; list?: SwipeSource }) {
  const services = useServices()
  const reducedMotion = useReducedMotion()
  // the list chosen in the collection's "Add by list" sheet, or one picked here
  const [ref, setRef] = useState<SwipeSource | null>(chosen ?? null)
  const [pickError, setPickError] = useState<string>()
  const [decided, setDecided] = useState<Set<number>>(() => new Set())
  const decidedRef = useRef(decided)
  const [said, setSaid] = useState('')
  const [leaving, setLeaving] = useState<Leaving>()
  const requested = useRef(new Set<number>())

  const data = useStoreData(
    async store => {
      const collection = (await store.collections()).find(c => c.id === id && !c.deleted)
      const bgg = ref?.kind === 'status' ? await store.bggCollection(ref.bggUser) : undefined
      const username = await store.bggUsername()
      return { id, collection, entries: await store.entries(id), lists: await store.lists(), bgg, username }
    },
    [id, sourceKey(ref)],
  )
  // a status list's collection is read when the device has none or an old one
  useBggCollection(ref?.kind === 'status' ? ref.bggUser : null)
  const list = ((): Swipeable | undefined => {
    if (!ref || !data) return undefined
    if (ref.kind === 'status') {
      if (!data.bgg?.loadedAt || data.bgg.error) return undefined
      const own = data.username?.toLowerCase() === ref.bggUser.toLowerCase()
      return { title: `${own ? '' : `${ref.bggUser}: `}${STATUS_NAMES[ref.status]} on BoardGameGeek`, ...statusSwipeList(data.bgg.items, ref.status) }
    }
    const stored = data.lists.find(l => l.kind === ref.kind && l.id === ref.id)
    return stored && { ...stored, retry: () => void services.lists.retry(stored.kind, stored.id) }
  })()
  const queue = list ? swipeQueue(list, [...(data?.entries ?? []), ...[...decided].map(bggId => ({ bggId, deleted: false }))]) : undefined
  const top = queue?.games[0]
  const next = queue?.games[1]
  const ahead = queue?.games.slice(0, AHEAD).map(g => g.bggId) ?? []
  const shown = useStoreData(async store => new Map((await store.games(ahead.slice(0, 2))).map(g => [g.bggId, g])), [ahead.slice(0, 2).join()])

  // the list loads its pages while it is swiped (a status list is on the device already)
  useEffect(() => {
    if (!ref || ref.kind === 'status') return
    let live = true
    const opening = services.lists.open(ref.kind, ref.id)
    opening.catch(error => {
      if (!live) return
      setRef(null)
      setPickError(error instanceof ApiError && error.code !== 'internal' ? error.message : LIST_ERROR)
    })
    return () => {
      live = false
      void opening.then(
        () => services.lists.close(ref.kind, ref.id),
        () => undefined,
      )
    }
  }, [ref, services.lists])

  // year and description of the next cards
  const aheadKey = ahead.join()
  useEffect(() => {
    const ids = ahead.filter(bggId => !requested.current.has(bggId))
    if (ids.length === 0) return
    ids.forEach(bggId => requested.current.add(bggId))
    void loadCardDetails(services, ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aheadKey, services])

  // the fling finishes on its own; the card is gone from the store's point of view already
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setLeaving(undefined), FLING_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  const collection = data?.collection
  const decide = useCallback(
    (direction: SwipeDirection, fromX = 0) => {
      if (!top || !collection || !list || decidedRef.current.has(top.bggId)) return
      decidedRef.current = new Set(decidedRef.current).add(top.bggId)
      setDecided(decidedRef.current)
      setSaid(direction === 'right' ? `Added ${top.name}` : `${top.name}: not interested`)
      if (!reducedMotion) setLeaving({ game: top, details: shown?.get(top.bggId), direction, fromX, key: Date.now() })
      void decideSwipe(services, collection, top, direction)
    },
    [top, collection, list, reducedMotion, services, shown],
  )

  // ← and → decide too, unless a field or a dialog has the keys
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      decide(event.key === 'ArrowRight' ? 'right' : 'left')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [decide])

  const back = href({ name: 'collection', id })
  if (!data || data.id !== id) return <Header title="" back={back} />
  if (!collection) {
    return (
      <>
        <Header title="Add by list" back={href({ name: 'collections' })} />
        <main className="screen">
          <div className="empty">
            <div className="hex" />
            <h2>This shopping list does not exist anymore</h2>
            <p>It may have been deleted on another device.</p>
            <div className="actions">
              <a className="btn btn-primary" href={href({ name: 'collections' })}>
                Go to your shopping lists
              </a>
            </div>
          </div>
        </main>
      </>
    )
  }

  const pick = (choice: SwipeSource) => {
    setPickError(undefined)
    setRef(choice)
  }
  const pickAnother = () => {
    setSaid('')
    setRef(null)
  }

  const topDetails = top ? shown?.get(top.bggId) : undefined
  const card = top
    ? [top.name, topDetails?.year, ...rowInfos(top.facts, { ...top.info, ...topDetails }).map(i => i.text)].filter(Boolean).join(', ')
    : queue?.allDecided
      ? "You've seen every game on this list"
      : list?.error
        ? list.error
        : 'More games are loading'
  const announcement = list ? [said, card].filter(Boolean).join('. ') : ''

  return (
    <>
      <Header title={`Add to ${collection.name}`} back={back} />
      <main className="screen swipe-screen">
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        {ref && !list && (
          <div className="empty">
            <div className="hex" />
            <h2>Loading the list…</h2>
            <p>The first games show up in a moment.</p>
          </div>
        )}
        {list && queue && (
          <>
            <p className="swipe-note">
              <i className="hex" aria-hidden="true" />
              <span>
                From <b>{list.title}</b>
                <br />
                Right adds the game, left passes on it.
              </span>
            </p>
            {queue.allDecided ? (
              <div className="empty">
                <div className="hex" />
                <h2>You&apos;ve seen every game on this list</h2>
                <p>Back to the shopping list to give them a category.</p>
                <div className="actions">
                  <a className="btn btn-primary" href={back}>
                    Open {collection.name}
                  </a>
                  <button type="button" className="btn" onClick={pickAnother}>
                    Pick another list
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="deck">
                  {(next || (top && queue.loadingMore)) && <div className="swipe-card behind" aria-hidden="true" />}
                  {top ? (
                    <SwipeCard
                      key={top.bggId}
                      game={top}
                      details={topDetails}
                      place="top"
                      enter={decided.size > 0}
                      reducedMotion={reducedMotion}
                      onDecide={decide}
                    />
                  ) : (
                    <div className="swipe-card top swipe-wait">
                      <div className="hex" aria-hidden="true" />
                      {list.error ? (
                        <>
                          <p>{list.error}</p>
                          <button type="button" className="btn" onClick={list.retry}>
                            Retry
                          </button>
                        </>
                      ) : (
                        <p>Loading more games…</p>
                      )}
                    </div>
                  )}
                  {leaving && (
                    <SwipeCard
                      key={`leaving-${leaving.key}`}
                      game={leaving.game}
                      details={leaving.details}
                      place="leaving"
                      leaving={leaving}
                      reducedMotion={reducedMotion}
                    />
                  )}
                </div>
                <div className="swipe-buttons">
                  <button type="button" className="swipe-btn no hex-btn" aria-label="Not interested" disabled={!top} onClick={() => decide('left')}>
                    ✕
                  </button>
                  <button type="button" className="swipe-btn yes hex-btn" aria-label="Add to shopping list" disabled={!top} onClick={() => decide('right')}>
                    ✓
                  </button>
                </div>
                <p className="swipe-legend">
                  <span aria-hidden="true">← Not interested</span>
                  <span>{queue.games.length === 0 ? 'More games loading' : `${gamesLeft(queue.games.length)}${queue.loadingMore ? ', more loading' : ''}`}</span>
                  <span aria-hidden="true">Add →</span>
                </p>
              </>
            )}
          </>
        )}
      </main>
      {!ref && (
        <ListPicker collection={collection} entries={data.entries} lists={data.lists} error={pickError} onPick={pick} onClose={() => navigate({ name: 'collection', id })} />
      )}
    </>
  )
}
