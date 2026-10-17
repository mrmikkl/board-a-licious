import { useSyncExternalStore } from 'react'

/** Device-wide, not per person: the intro is not shown again after signing out (FR-027). */
const SEEN = 'bal-intro-seen'

// without storage (private mode, blocked) the intro shows once per page session and never blocks
let seenThisSession = false
let open: boolean | undefined
const listeners = new Set<() => void>()

function seen(): boolean {
  if (seenThisSession) return true
  try {
    return localStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}

function setOpen(value: boolean) {
  open = value
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Whether the intro shows: on first start on this device, or when asked for again. */
export function useIntroOpen(): boolean {
  return useSyncExternalStore(subscribe, () => (open ??= !seen()))
}

/** "Show the intro again" on the Collections screen. */
export function showIntro() {
  setOpen(true)
}

/** Skip or "Let's go": remembered on this device. */
export function finishIntro() {
  seenThisSession = true
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // no storage: shown again on the next start, which is fine
  }
  setOpen(false)
}
