import { type CSSProperties, type PointerEvent, useRef } from 'react'

import type { Game, ListEntryFacts, StoredListEntry } from '../../client/types.ts'
import { formatMoney } from '../../domain/money.ts'
import type { SwipeDirection } from '../../domain/swipe.ts'
import { HexCover } from './HexCover.tsx'

/** "Booth 3-R400 · €60 · Inside Up Games", or null when the list says nothing. */
export function factsLine(facts?: ListEntryFacts): string | null {
  if (!facts) return null
  const parts = [facts.booth ? `Booth ${facts.booth}` : null, facts.priceCents != null ? formatMoney(facts.priceCents, facts.currency) : null, facts.publisher]
  const line = parts.filter(Boolean).join(' · ')
  return line || null
}

/** How far the card must travel before letting go decides. */
const THRESHOLD = 90

/**
 * The swipe card (docs/design.md §7, §9): cover, name, year, description (3 lines), facts. The top
 * card follows the finger with tilt and growing ADD/NOPE stamps, springs back when let go early and
 * decides past the threshold. `leaving` flings it out; with reduced motion nothing tilts or flies.
 */
export function SwipeCard({
  game,
  details,
  isEssen,
  place,
  enter = false,
  leaving,
  reducedMotion,
  onDecide,
}: {
  game: StoredListEntry
  details?: Game
  isEssen: boolean
  place: 'top' | 'behind' | 'leaving'
  enter?: boolean
  leaving?: { direction: SwipeDirection; fromX: number }
  reducedMotion: boolean
  onDecide?: (direction: SwipeDirection, fromX: number) => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const add = useRef<HTMLSpanElement>(null)
  const nope = useRef<HTMLSpanElement>(null)
  const drag = useRef<{ x0: number; dx: number; id: number } | null>(null)

  const show = (dx: number) => {
    const el = card.current
    if (!el) return
    el.style.transform = dx === 0 ? '' : reducedMotion ? `translateX(${dx}px)` : `translate(${dx}px, ${Math.abs(dx) * 0.08}px) rotate(${dx / 14}deg) scale(1.03)`
    const yes = Math.max(0, Math.min(1, dx / THRESHOLD))
    const no = Math.max(0, Math.min(1, -dx / THRESHOLD))
    if (add.current) Object.assign(add.current.style, { opacity: String(yes), scale: String(0.7 + 0.5 * yes) })
    if (nope.current) Object.assign(nope.current.style, { opacity: String(no), scale: String(0.7 + 0.5 * no) })
  }

  const top = place === 'top' && onDecide
  const handlers = top
    ? {
        onPointerDown(event: PointerEvent<HTMLDivElement>) {
          if (event.button !== 0) return
          drag.current = { x0: event.clientX, dx: 0, id: event.pointerId }
          event.currentTarget.setPointerCapture(event.pointerId)
          event.currentTarget.classList.add('dragging')
        },
        onPointerMove(event: PointerEvent<HTMLDivElement>) {
          if (!drag.current || drag.current.id !== event.pointerId) return
          drag.current.dx = event.clientX - drag.current.x0
          show(drag.current.dx)
        },
        onPointerUp(event: PointerEvent<HTMLDivElement>) {
          const current = drag.current
          if (!current || current.id !== event.pointerId) return
          drag.current = null
          event.currentTarget.classList.remove('dragging')
          if (current.dx > THRESHOLD) onDecide('right', current.dx)
          else if (current.dx < -THRESHOLD) onDecide('left', current.dx)
          else show(0) // springs back with overshoot (CSS transition)
        },
        onPointerCancel(event: PointerEvent<HTMLDivElement>) {
          drag.current = null
          event.currentTarget.classList.remove('dragging')
          show(0)
        },
      }
    : {}

  const facts = isEssen ? factsLine(game.facts) : null
  const cover: Game = details ?? { bggId: game.bggId, name: game.name, year: null, thumbnailUrl: game.thumbnailUrl, description: null, kind: 'boardgame' }
  const style = leaving ? ({ '--dir': leaving.direction === 'right' ? 1 : -1, '--from-x': `${leaving.fromX}px` } as CSSProperties) : undefined
  const classes = ['swipe-card', place, enter && !reducedMotion ? 'enter' : '', leaving ? `leaving-${leaving.direction}` : ''].filter(Boolean).join(' ')

  return (
    <div
      ref={card}
      className={classes}
      style={style}
      role={place === 'top' ? 'group' : undefined}
      aria-label={place === 'top' ? `Game: ${game.name}` : undefined}
      aria-hidden={place === 'top' ? undefined : true}
      {...handlers}
    >
      <span ref={add} className="swipe-stamp add" aria-hidden="true">
        ADD
      </span>
      <span ref={nope} className="swipe-stamp nope" aria-hidden="true">
        NOPE
      </span>
      <HexCover game={cover} name={game.name} size={104} />
      <h2 className="swipe-name">{details?.name ?? game.name}</h2>
      <p className="swipe-year">{details?.year ?? ' '}</p>
      {details?.description && <p className="swipe-desc">{details.description}</p>}
      {facts ? <p className="swipe-facts">{facts}</p> : <p className="swipe-nofacts">{isEssen ? 'No booth or price for this game yet' : 'No booth or price on this list'}</p>}
    </div>
  )
}
