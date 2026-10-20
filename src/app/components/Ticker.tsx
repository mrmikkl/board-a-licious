import { type HTMLAttributes, useLayoutEffect, useRef } from 'react'

/** Room for the right edge fade, so the end of the text is clear of it when the ticker stops. */
const FADE = 24

/**
 * A heading (`h1`) for text that may be too long for its row (docs/design.md "Ticker", research R4):
 * a long text shows its start, runs left at about 50px/s until its end is visible, pauses and starts
 * over; shorter text stands still. The text stays the heading's own text, so it is read once.
 */
export function Ticker({ text, className, ...props }: { text: string } & HTMLAttributes<HTMLHeadingElement>) {
  const ref = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    const heading = ref.current
    const span = heading?.firstElementChild
    if (!heading || !span) return
    let frame = 0
    let last = NaN
    const measure = () => {
      const shift = span.scrollWidth - heading.clientWidth + FADE
      // writing styles only on a real change keeps the observer from firing in a loop
      if (shift === last) return
      last = shift
      heading.classList.toggle('is-long', shift > FADE)
      heading.style.setProperty('--ticker-shift', `${shift}px`)
      // the text moves during 64% of a loop (holds of 18% at both ends)
      heading.style.setProperty('--ticker-time', `${Math.max(4, shift / 50 / 0.64)}s`)
    }
    measure()
    // measure after the resize has been delivered, not inside the observer's callback
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    })
    observer.observe(heading)
    observer.observe(span)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [text])
  return (
    <h1 {...props} ref={ref} className={className ? `ticker ${className}` : 'ticker'}>
      <span>{text}</span>
    </h1>
  )
}
