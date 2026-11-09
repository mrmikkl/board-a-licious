import { useEffect, useRef } from 'react'

export type Range = [number, number]
type Handle = 'from' | 'to'

const tenth = (v: number) => Math.round(v * 10) / 10

/** Whole numbers stick (design.md): while a pointer drags, a value within 0.2 of one rests on it; keys step freely. */
export function snap(value: number, dragging: boolean): number {
  const v = tenth(value)
  const whole = Math.round(v)
  return dragging && Math.abs(v - whole) <= 0.2 + 1e-9 ? whole : v
}

/** The range with one handle moved; the handles cannot cross. */
export function moveHandle([from, to]: Range, handle: Handle, value: number): Range {
  return handle === 'from' ? [Math.min(value, to), to] : [from, Math.max(value, from)]
}

/** The chosen range beside a section's title: "7.5 – 10.0", "any" at full width. */
export function rangeText([from, to]: Range): string {
  return from <= 0 && to >= 10 ? 'any' : `${from.toFixed(1)} – ${to.toFixed(1)}`
}

/**
 * F009 (docs/design.md "List filter"): a two-handle slider over 0–10 in steps of 0.1: two native ranges
 * on one track (each its own slider for keys and screen readers, "<label> from" / "<label> to"),
 * hexagon handles, the range between filled hot, ticks and the whole numbers 0…10 below.
 */
export function RangeSlider({ label, value, onChange }: { label: string; value: Range; onChange: (value: Range) => void }) {
  const dragging = useRef(false)
  useEffect(() => {
    const stop = () => (dragging.current = false)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])
  const [from, to] = value
  const input = (handle: Handle, current: number) => (
    <input
      type="range"
      min={0}
      max={10}
      step={0.1}
      value={current}
      aria-label={`${label} ${handle}`}
      aria-valuetext={current.toFixed(1)}
      // two handles on one spot: the one that can still move away from the edge lies on top
      style={{ zIndex: handle === 'from' && from >= 5 ? 2 : 1 }}
      onPointerDown={() => (dragging.current = true)}
      onChange={e => onChange(moveHandle(value, handle, snap(Number(e.target.value), dragging.current)))}
    />
  )
  return (
    <>
      <div className="slider">
        <span className="track" />
        <span className="ticks" />
        <span className="fill" style={{ left: `${from * 10}%`, right: `${100 - to * 10}%` }} />
        {input('from', from)}
        {input('to', to)}
      </div>
      <div className="slider-scale" aria-hidden="true">
        {Array.from({ length: 11 }, (_, n) => (
          <span key={n} style={{ left: `${n * 10}%` }}>
            {n}
          </span>
        ))}
      </div>
    </>
  )
}
