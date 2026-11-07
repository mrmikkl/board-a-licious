/**
 * At most one request per `minGapMs`: each caller books its own start time and waits only on its own
 * timer. Never a promise shared across Worker requests: a cancelled request leaves its promises
 * unsettled forever, and a chained queue would hold up every later request (feature 006, research R11).
 */
export function createSlots(minGapMs: number, now: () => number, sleep: (ms: number) => Promise<void>) {
  let nextSlot = -Infinity
  return async function waitForSlot() {
    const slot = Math.max(now(), nextSlot)
    nextSlot = slot + minGapMs
    const wait = slot - now()
    if (wait > 0) await sleep(wait)
  }
}
