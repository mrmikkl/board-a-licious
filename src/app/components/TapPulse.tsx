import { useEffect } from 'react'

const TARGETS = '.btn, .icon-btn, .card, .row, .tile, .hex-btn, .tab'

/** An orange hexagon pulse from the tap point on interactive elements (docs/design.md §8). */
export function TapPulse() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onDown = (event: PointerEvent) => {
      if (reduced.matches) return
      const target = event.target as Element | null
      if (!target?.closest(TARGETS) || target.closest(':disabled')) return
      const pulse = document.createElement('span')
      pulse.className = 'tap-pulse'
      pulse.style.left = `${event.clientX}px`
      pulse.style.top = `${event.clientY}px`
      pulse.addEventListener('animationend', () => pulse.remove())
      document.body.append(pulse)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
  return null
}
