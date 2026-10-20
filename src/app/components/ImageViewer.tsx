import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ApiError } from '../../client/api.ts'
import type { GameImage } from '../../domain/gallery.ts'
import { useServices } from '../context.tsx'
import { type Swipe, dragEffect, moveSwipe, pinchSwipe, releaseSwipe, startSwipe } from '../viewer-gesture.ts'
import { HexCover } from './HexCover.tsx'

export type ImageViewerProps = {
  /** the game shown: its BGG id (for the gallery) and name */
  game: { bggId: number; name: string }
  /** the cover already on the phone, shown at once (null: initials) */
  cover: string | null
  /** details not loaded yet: no gallery, a note instead */
  pending?: boolean
  onClose: () => void
}

type Gallery = { state: 'pending' | 'loading' | 'ready' | 'offline' | 'failed'; images: GameImage[] }

type Slide = { key: number; large: string | null; placeholder: string | null; caption: string | null }

const MAX_DOTS = 12

const NOTES = {
  pending: 'No images yet: they follow once BoardGameGeek details are loaded.',
  offline: 'You are offline: more images of this game once you are back online.',
  failed: 'BoardGameGeek did not answer: more images of this game later.',
  ready: 'BoardGameGeek has no more images of this game.',
  loading: null,
}

/** navigator.onLine, kept up to date by the online/offline events. */
function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/**
 * Full-screen image viewer (docs/design.md "Image viewer", FR-001–FR-006): the cover at once, the
 * game's BoardGameGeek gallery as a track of slides moved by transform only (FR-002a); swipe, ‹ ›
 * and ←/→ step; ✕, Esc, Back and a swipe down close. Opening pushes a history entry, so Back closes
 * (research R6); focus moves in and back to the cover on close.
 */
export function ImageViewer({ game, cover, pending = false, onClose }: ImageViewerProps) {
  const { api } = useServices()
  const online = useOnline()
  const [gallery, setGallery] = useState<Gallery>({ state: pending ? 'pending' : 'loading', images: [] })
  const [index, setIndex] = useState(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // the gallery, once per game and session (the API keeps it, research R3); offline: no request
  useEffect(() => {
    if (pending) return
    if (!online) {
      setGallery(current => (current.state === 'ready' ? current : { state: 'offline', images: [] }))
      return
    }
    let cancelled = false
    api.gallery(game.bggId).then(
      loaded => !cancelled && setGallery({ state: 'ready', images: loaded.images }),
      (error: unknown) => !cancelled && setGallery({ state: error instanceof ApiError && error.code === 'offline' ? 'offline' : 'failed', images: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [api, game.bggId, pending, online])

  const slides: Slide[] =
    gallery.images.length > 0
      ? gallery.images.map((image, k) => ({ key: image.id, large: image.large, placeholder: k === 0 && cover ? cover : image.small, caption: image.caption }))
      : [{ key: 0, large: cover, placeholder: null, caption: null }]
  const count = slides.length
  const current = Math.min(index, count - 1)
  const indexRef = useRef(current)
  indexRef.current = current
  const countRef = useRef(count)
  countRef.current = count

  const step = useCallback((delta: number) => setIndex(i => Math.max(0, Math.min(countRef.current - 1, i + delta))), [])
  // ✕, Esc and a swipe down go through history, so Back and they close the same way
  const close = useCallback(() => {
    if (history.state?.viewer) history.back()
    else onCloseRef.current()
  }, [])

  // Back closes: one history entry for the open viewer (idempotent: StrictMode runs effects twice)
  useEffect(() => {
    if (!history.state?.viewer) history.pushState({ ...history.state, viewer: true }, '')
    const onPop = () => onCloseRef.current()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // focus in, keys; back to the cover on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowRight') step(1)
      else if (event.key === 'ArrowLeft') step(-1)
      else return
      // the sheet below listens for Escape too
      event.stopPropagation()
      event.preventDefault()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      previous?.focus?.()
    }
  }, [close, step])

  // swipes: the maths in viewer-gesture.ts, the track and backdrop moved directly, without a render
  useEffect(() => {
    const stage = stageRef.current
    const track = trackRef.current
    const box = dialogRef.current
    if (!stage || !track || !box) return
    let swipe: Swipe | null = null
    const down = new Set<number>()
    const base = () => `translateX(${-indexRef.current * 100}%)`
    const settle = () => {
      swipe = null
      down.clear()
      track.classList.remove('is-dragging')
      box.style.backgroundColor = ''
      track.style.transform = base()
    }
    const onDown = (event: PointerEvent) => {
      if ((event.target as Element).closest('button')) return
      down.add(event.pointerId)
      if (down.size > 1) {
        if (swipe) swipe = pinchSwipe(swipe)
        return
      }
      swipe = startSwipe(event.clientX, event.clientY, event.timeStamp)
      stage.setPointerCapture(event.pointerId)
      track.classList.add('is-dragging')
    }
    const onMove = (event: PointerEvent) => {
      if (!swipe) return
      swipe = moveSwipe(swipe, event.clientX, event.clientY, event.timeStamp)
      const effect = dragEffect(swipe, indexRef.current, countRef.current)
      if (effect.kind === 'drag-x') track.style.transform = `translateX(calc(${-indexRef.current * 100}% + ${effect.offset}px))`
      else if (effect.kind === 'drag-y') {
        track.style.transform = `translate(${-indexRef.current * 100}%, ${effect.offset}px)`
        box.style.backgroundColor = `rgba(5, 6, 14, ${effect.backdrop})`
      }
    }
    const onUp = (event: PointerEvent) => {
      down.delete(event.pointerId)
      if (!swipe || down.size > 0) return
      const outcome = releaseSwipe(swipe, indexRef.current, countRef.current)
      settle()
      if (outcome.kind === 'close') close()
      else if (outcome.kind === 'step') step(outcome.delta)
    }
    const onCancel = () => swipe && settle()
    stage.addEventListener('pointerdown', onDown)
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerup', onUp)
    stage.addEventListener('pointercancel', onCancel)
    return () => {
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerup', onUp)
      stage.removeEventListener('pointercancel', onCancel)
    }
  }, [close, step])

  const several = count > 1
  const dots = Math.min(count, MAX_DOTS)
  const activeDot = dots === count ? current : Math.round((current * (dots - 1)) / (count - 1))
  const caption = slides[current]?.caption ?? `Image ${current + 1}`
  const note = several ? null : NOTES[gallery.state]

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Images of ${game.name}`} tabIndex={-1} ref={dialogRef}>
      <div className="viewer-top">
        <p className="viewer-name">{game.name}</p>
        {several && (
          <span className="viewer-count" aria-live="polite">
            {current + 1} / {count}
          </span>
        )}
        <button type="button" className="viewer-close" aria-label="Close" onClick={close}>
          ✕
        </button>
      </div>
      <div className="viewer-stage" ref={stageRef}>
        <div className="viewer-track" ref={trackRef} style={{ transform: `translateX(${-current * 100}%)` }}>
          {slides.map((slide, k) => (
            <SlideView key={slide.key} slide={slide} name={game.name} alt={several ? `${game.name}, image ${k + 1} of ${count}` : game.name} distance={Math.abs(k - current)} />
          ))}
        </div>
        {several && (
          <>
            <button type="button" className="viewer-nav prev" aria-label="Previous image" disabled={current === 0} onClick={() => step(-1)}>
              ‹
            </button>
            <button type="button" className="viewer-nav next" aria-label="Next image" disabled={current === count - 1} onClick={() => step(1)}>
              ›
            </button>
          </>
        )}
      </div>
      <div className="viewer-bottom">
        {several ? (
          <>
            <div className="viewer-dots" aria-hidden="true">
              {Array.from({ length: dots }, (_, k) => (
                <i key={k} className={k === activeDot ? 'on' : undefined} />
              ))}
            </div>
            <p className="viewer-caption">{caption} · from BoardGameGeek</p>
          </>
        ) : (
          note && <p className="viewer-note">{note}</p>
        )}
      </div>
    </div>,
    document.body,
  )
}

/**
 * One slide: the placeholder (cover or BGG's small version) until the large image has loaded; the
 * large one is fetched for the current image and its neighbours only (research R4), slides further
 * than two away stay empty until swiped near.
 */
function SlideView({ slide, name, alt, distance }: { slide: Slide; name: string; alt: string; distance: number }) {
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const { large, placeholder } = slide
  const near = distance <= 1
  useEffect(() => {
    if (!near || !large || !placeholder || loaded === large || failed === large) return
    const image = new Image()
    image.referrerPolicy = 'no-referrer'
    image.onload = () => setLoaded(large)
    image.onerror = () => setFailed(large)
    image.src = large
    return () => {
      image.onload = null
      image.onerror = null
    }
  }, [near, large, placeholder, loaded, failed])

  if (distance > 2) return <div className="viewer-slide" />
  const src = loaded === large ? large : (placeholder ?? (near ? large : null))
  if (!src) {
    return (
      <div className="viewer-slide">
        {large === null && (
          <span role="img" aria-label={name}>
            <HexCover name={name} pending size={220} />
          </span>
        )}
      </div>
    )
  }
  return (
    <div className="viewer-slide">
      <img src={src} alt={alt} decoding="async" draggable={false} referrerPolicy="no-referrer" onError={() => src === large && setFailed(large)} />
      {failed === large && <p className="viewer-note">This image could not be loaded.</p>}
    </div>
  )
}
