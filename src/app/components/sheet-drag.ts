/** How far a sheet must be pulled down, or how fast, to close (px, px per ms). */
export const CLOSE_DISTANCE = 100
export const CLOSE_SPEED = 0.6
/** A flick also has to travel this far, so a small twitch never closes the sheet. */
export const FLICK_MIN = 40

/** Whether a downward drag should close the sheet. */
export function shouldClose(distance: number, ms: number): boolean {
  if (distance <= 0) return false
  return distance >= CLOSE_DISTANCE || (distance >= FLICK_MIN && distance / Math.max(ms, 1) >= CLOSE_SPEED)
}
