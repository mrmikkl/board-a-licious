/**
 * The small rewards of docs/design.md §9: a hexagon burst for Must Have, a "GOT IT!" stamp plus a
 * burst for Bought, and counters that roll to their new value. Screens and actions call
 * `celebrate()`; the one overlay in App.tsx listens, so nobody passes props around.
 */
export type CelebrateKind = 'must_have' | 'bought'
export type Point = { x: number; y: number }
export type CelebrateDetail = { kind: CelebrateKind; from?: Point }

const EVENT = 'bal:celebrate'

export function celebrate(detail: CelebrateDetail, target: EventTarget = window) {
  target.dispatchEvent(new CustomEvent<CelebrateDetail>(EVENT, { detail }))
}

/** Calls `listener` for every celebration until the returned function is called. */
export function onCelebrate(listener: (detail: CelebrateDetail) => void, target: EventTarget = window) {
  const handle = (event: Event) => listener((event as CustomEvent<CelebrateDetail>).detail)
  target.addEventListener(EVENT, handle)
  return () => target.removeEventListener(EVENT, handle)
}

/** Centre of a tapped element, where the burst starts. */
export const centreOf = (element: Element | null | undefined): Point | undefined => {
  if (!element) return undefined
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** The two ends of the gradient each burst mixes its colours from (docs/design.md §3). */
export const BURST_COLOURS: Record<CelebrateKind, readonly [string, string]> = {
  must_have: ['#ff7a1a', '#ffb020'],
  bought: ['#0fb98f', '#7cf0c5'],
}

export type Particle = { angle: number; distance: number; size: number; colour: string }

const mix = (from: string, to: string, t: number) => {
  const a = Number.parseInt(from.slice(1), 16)
  const b = Number.parseInt(to.slice(1), 16)
  const channel = (shift: number) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t)
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`
}

/** One hexagon per slice of the circle (angle in degrees), 60–140 px out, 8–16 px wide. */
export function burstParticles(kind: CelebrateKind, { count = 20, random = Math.random }: { count?: number; random?: () => number } = {}): Particle[] {
  const slice = 360 / count
  const [from, to] = BURST_COLOURS[kind]
  return Array.from({ length: count }, (_, i) => ({
    angle: i * slice + random() * slice,
    distance: 60 + random() * 80,
    size: 8 + random() * 8,
    colour: mix(from, to, random()),
  }))
}

export const ROLL_MS = 650

/** The counter's value `elapsed` ms into a roll from `from` to `to`: eased out, whole numbers. */
export function rollValue(from: number, to: number, elapsed: number, duration = ROLL_MS) {
  if (elapsed >= duration) return to
  const t = Math.max(0, elapsed) / duration
  const eased = 1 - (1 - t) ** 3
  return Math.round(from + (to - from) * eased)
}
