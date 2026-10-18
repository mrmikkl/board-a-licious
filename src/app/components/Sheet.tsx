import { type ReactNode, useEffect, useId, useRef } from 'react'

import { shouldClose } from './sheet-drag.ts'

/**
 * Bottom sheet (docs/design.md §7): closes with Esc, a tap on the scrim, Cancel, or by pulling it
 * down on a touch screen (from the handle, or anywhere while it is scrolled to the top); never saves
 * on its own. Focus moves into the sheet and back to where it came from.
 */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus?.()
    }
  }, [open, onClose])

  // pull down to close: touch events, so scrolling the sheet's content keeps working
  useEffect(() => {
    const sheet = ref.current
    if (!open || !sheet) return
    let startY = 0
    let startAt = 0
    let dragging = false
    let candidate = false
    const move = (dy: number) => {
      sheet.style.transform = dy > 0 ? `translate(-50%, ${dy}px)` : ''
    }
    const onStart = (event: TouchEvent) => {
      const onGrip = (event.target as Element).closest('.sheet-grip') !== null
      candidate = onGrip || sheet.scrollTop <= 0
      dragging = false
      startY = event.touches[0]?.clientY ?? 0
      startAt = event.timeStamp
    }
    const onMove = (event: TouchEvent) => {
      if (!candidate) return
      const dy = (event.touches[0]?.clientY ?? 0) - startY
      if (!dragging) {
        if (dy < 8) {
          if (dy < -4) candidate = false // scrolling up the content
          return
        }
        dragging = true
        sheet.classList.add('is-dragging')
      }
      event.preventDefault()
      move(dy)
    }
    const onEnd = (event: TouchEvent) => {
      if (!dragging) return
      const dy = (event.changedTouches[0]?.clientY ?? startY) - startY
      dragging = false
      sheet.classList.remove('is-dragging')
      if (shouldClose(dy, event.timeStamp - startAt)) return onClose()
      sheet.classList.add('is-settling')
      move(0)
      window.setTimeout(() => sheet.classList.remove('is-settling'), 220)
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" aria-hidden="true" />
        <h2 id={titleId} className="sheet-title">
          {title}
        </h2>
        {children}
      </div>
    </>
  )
}
