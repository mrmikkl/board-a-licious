import { useEffect, useSyncExternalStore } from 'react'

/**
 * F002 "Just added" (docs/design.md v1.9.0 Motion): the game row added last (e.g. from a share)
 * keeps the hover highlight until the user scrolls or taps elsewhere.
 */
let current: { collectionId: string; bggId: number } | undefined
const listeners = new Set<() => void>()

function set(next: typeof current) {
  current = next
  listeners.forEach(listener => listener())
}

export function markJustAdded(collectionId: string, bggId: number): void {
  set({ collectionId, bggId })
}

export function justAddedIn(collectionId: string): number | undefined {
  return current?.collectionId === collectionId ? current.bggId : undefined
}

export function subscribeJustAdded(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Clears the highlight on the first scroll (of any element) or pointerdown on `target`. */
export function clearJustAddedOn(target: EventTarget): () => void {
  const listening = new AbortController()
  const clear = () => {
    listening.abort()
    if (current) set(undefined)
  }
  // capture: scroll does not bubble, and the list may scroll inside an element
  target.addEventListener('scroll', clear, { capture: true, signal: listening.signal })
  target.addEventListener('pointerdown', clear, { capture: true, signal: listening.signal })
  return () => listening.abort()
}

/** The bggId to highlight in this collection, or undefined; re-renders when it is cleared. */
export function useJustAdded(collectionId: string): number | undefined {
  const bggId = useSyncExternalStore(subscribeJustAdded, () => justAddedIn(collectionId))
  useEffect(() => {
    if (bggId === undefined) return
    // listen from the next frame on, so the scroll to the top on navigating here does not count
    let stop = () => {}
    const frame = requestAnimationFrame(() => (stop = clearJustAddedOn(window)))
    return () => {
      cancelAnimationFrame(frame)
      stop()
    }
  }, [bggId])
  return bggId
}
