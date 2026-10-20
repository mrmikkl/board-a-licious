/**
 * The image viewer's swipe maths (research R5), pure and without the DOM: the component feeds it
 * pointer positions and applies the effects to the track and the backdrop.
 */

/** A finger is locked to an axis after this many px. */
export const AXIS_LOCK = 8
/** A sideways drag steps after this many px, or when it is a flick. */
export const STEP_DISTANCE = 50
/** A flick: faster than this (px per ms) and at least FLICK_MIN px long, so a twitch never counts. */
export const FLICK_SPEED = 0.5
export const FLICK_MIN = 20
/** A drag down closes after this many px. */
export const CLOSE_DISTANCE = 100
/** Past the first or last image the track follows only this fraction of the finger. */
export const EDGE_RESISTANCE = 1 / 3
/** The backdrop fades with a drag down, never below this opacity. */
export const BACKDROP_MIN = 0.3
const BACKDROP_FADE_PX = 400

export type Swipe = {
  x0: number
  y0: number
  t0: number
  x: number
  y: number
  t: number
  axis: 'x' | 'y' | null
  /** more than one: a pinch, the browser zooms and the swipe is ignored */
  pointers: number
}

export type DragEffect = { kind: 'none' } | { kind: 'ignore' } | { kind: 'drag-x'; offset: number } | { kind: 'drag-y'; offset: number; backdrop: number }

export type ReleaseOutcome = { kind: 'step'; delta: 1 | -1 } | { kind: 'settle' } | { kind: 'close' } | { kind: 'ignore' }

export function startSwipe(x: number, y: number, at: number): Swipe {
  return { x0: x, y0: y, t0: at, x, y, t: at, axis: null, pointers: 1 }
}

/** The finger moved; the axis locks after AXIS_LOCK px in the dominant direction and then stays. */
export function moveSwipe(swipe: Swipe, x: number, y: number, at: number): Swipe {
  const dx = x - swipe.x0
  const dy = y - swipe.y0
  const axis = swipe.axis ?? (Math.hypot(dx, dy) > AXIS_LOCK ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null)
  return { ...swipe, x, y, t: at, axis }
}

/** A second finger went down: the browser's pinch zoom takes over. */
export function pinchSwipe(swipe: Swipe): Swipe {
  return { ...swipe, pointers: swipe.pointers + 1 }
}

const atEdge = (dx: number, index: number, count: number) => (dx > 0 && index === 0) || (dx < 0 && index >= count - 1)

/** What the track and the backdrop should show for the finger's current place. */
export function dragEffect(swipe: Swipe, index: number, count: number): DragEffect {
  if (swipe.pointers > 1) return { kind: 'ignore' }
  const dx = swipe.x - swipe.x0
  const dy = swipe.y - swipe.y0
  if (swipe.axis === 'x') return { kind: 'drag-x', offset: atEdge(dx, index, count) ? dx * EDGE_RESISTANCE : dx }
  if (swipe.axis === 'y') {
    const offset = Math.max(0, dy)
    return { kind: 'drag-y', offset, backdrop: Math.max(BACKDROP_MIN, 1 - offset / BACKDROP_FADE_PX) }
  }
  return { kind: 'none' }
}

const isFlick = (distance: number, ms: number) => distance >= FLICK_MIN && distance / Math.max(ms, 1) > FLICK_SPEED

/** The finger lifted: step to a neighbour, close, or spring back to the current image. */
export function releaseSwipe(swipe: Swipe, index: number, count: number): ReleaseOutcome {
  if (swipe.pointers > 1) return { kind: 'ignore' }
  const dx = swipe.x - swipe.x0
  const dy = swipe.y - swipe.y0
  const ms = swipe.t - swipe.t0
  if (swipe.axis === 'x') {
    if (atEdge(dx, index, count)) return { kind: 'settle' }
    if (Math.abs(dx) > STEP_DISTANCE || isFlick(Math.abs(dx), ms)) return { kind: 'step', delta: dx < 0 ? 1 : -1 }
    return { kind: 'settle' }
  }
  if (swipe.axis === 'y' && dy > 0 && (dy > CLOSE_DISTANCE || isFlick(dy, ms))) return { kind: 'close' }
  return { kind: 'settle' }
}
