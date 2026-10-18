import { type PointerEvent, useCallback, useEffect, useRef, useState } from 'react'

import { finishIntro } from '../intro.ts'
import { navigate } from '../router.ts'

/** Pixels a card has to travel before a swipe counts. */
const THRESHOLD = 60

const CARDS = [
  {
    title: 'Collections',
    text: 'Keep a collection for SPIEL Essen and more for anything else. Mark every game: Must Have, Interested, Unsure or Poop.',
    art: ['⭐', '👀', '🤔', '💩'],
  },
  {
    title: 'BGG lists',
    text: 'Load the SPIEL preview or any geeklist once. Games keep booth, price and edition wherever a list has them.',
    art: ['📋', '📍', '💶', '🏷️'],
  },
  {
    title: 'Swipe, then hunt',
    text: 'Swipe right to add a game, left for not interested. At the fair, filter to “Must Have, not bought” and tick off what you got.',
    art: ['👉', '🛑', '✅', '🎲'],
  },
]

/**
 * Introduction on first start (FR-027): three cards, moved by swipe, buttons or arrow keys. Every
 * card can be skipped; Skip and "Let's go" lead to Collections.
 */
export function Intro() {
  const [index, setIndex] = useState(0)
  const [from, setFrom] = useState<'next' | 'back'>()
  const next = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x0: number; dx: number; id: number } | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const last = index === CARDS.length - 1

  const done = useCallback(() => {
    finishIntro()
    navigate({ name: 'collections' })
  }, [])
  const go = useCallback(
    (step: 1 | -1) => {
      const target = index + step
      if (target < 0 || target >= CARDS.length) return
      setFrom(step > 0 ? 'next' : 'back')
      setIndex(target)
    },
    [index],
  )

  useEffect(() => next.current?.focus(), [])

  // ← and → move through the cards, Esc skips
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'Escape') done()
      else return
      event.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go, done])

  const follow = (dx: number) => {
    if (card.current) card.current.style.translate = dx ? `${dx}px 0` : ''
  }
  const swipe = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0) return
      event.preventDefault() // the focus stays on Next
      drag.current = { x0: event.clientX, dx: 0, id: event.pointerId }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (!drag.current || drag.current.id !== event.pointerId) return
      drag.current.dx = event.clientX - drag.current.x0
      follow(drag.current.dx)
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const current = drag.current
      if (!current || current.id !== event.pointerId) return
      drag.current = null
      follow(0)
      if (current.dx < -THRESHOLD) go(1)
      else if (current.dx > THRESHOLD) go(-1)
    },
    onPointerCancel() {
      drag.current = null
      follow(0)
    },
  }

  const { title, text, art } = CARDS[index]!
  return (
    <main className="intro">
      <section className="intro-carousel" aria-roledescription="carousel" aria-label="Introduction">
        <div className="intro-track" aria-live="polite" {...swipe}>
          <div
            key={index}
            ref={card}
            className={`intro-card${from ? ` from-${from}` : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${CARDS.length}`}
          >
            <div className="intro-art" aria-hidden="true">
              {art.map(symbol => (
                <span key={symbol} className="hex">
                  <span>{symbol}</span>
                </span>
              ))}
            </div>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        </div>
        <div className="intro-dots" aria-hidden="true">
          {CARDS.map((c, i) => (
            <i key={c.title} className={`hex${i === index ? ' on' : ''}`} />
          ))}
        </div>
        <div className="intro-actions">
          <button type="button" className="link-btn" onClick={done}>
            Skip
          </button>
          <button ref={next} type="button" className="btn btn-primary" onClick={last ? done : () => go(1)}>
            {last ? "Let's go" : 'Next'}
          </button>
        </div>
      </section>
    </main>
  )
}
