import { useLayoutEffect, useRef, useState } from 'react'

import { ROLL_MS, rollValue } from '../celebrate.ts'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A count that rolls from the old to the new value and flashes amber (docs/design.md §9). The final
 * value is in the text right away; the rolling digits on top are visual only.
 */
export function Counter({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const [flash, setFlash] = useState(0)
  const shownRef = useRef(value)
  useLayoutEffect(() => {
    const show = (n: number) => {
      shownRef.current = n
      setShown(n)
    }
    const from = shownRef.current
    if (from === value) return
    if (reducedMotion()) return show(value)
    setFlash(n => n + 1)
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      show(rollValue(from, value, now - start))
      if (now - start < ROLL_MS) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return (
    <span key={flash} className={flash > 0 ? 'counter flash' : 'counter'}>
      {shown === value ? (
        value
      ) : (
        <>
          <span className="counter-final">{value}</span>
          <span className="counter-roll" aria-hidden="true">
            {shown}
          </span>
        </>
      )}
    </span>
  )
}
