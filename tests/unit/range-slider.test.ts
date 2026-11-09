import { describe, expect, it } from 'vitest'

import { moveHandle, rangeText, snap } from '../../src/app/components/RangeSlider.tsx'

describe('snap (design.md "Whole numbers stick")', () => {
  it('rests on a whole number within 0.2 while a pointer drags', () => {
    expect(snap(6.85, true)).toBe(7)
    expect(snap(7.2, true)).toBe(7)
    expect(snap(6.8, true)).toBe(7)
    expect(snap(0.1, true)).toBe(0)
    expect(snap(9.9, true)).toBe(10)
  })

  it('keeps values farther away, in steps of 0.1', () => {
    expect(snap(6.6, true)).toBe(6.6)
    expect(snap(7.3, true)).toBe(7.3)
    expect(snap(6.7000000001, true)).toBe(6.7)
  })

  it('never snaps keys', () => {
    expect(snap(6.9, false)).toBe(6.9)
    expect(snap(7.1, false)).toBe(7.1)
    expect(snap(7.0000001, false)).toBe(7)
  })
})

describe('moveHandle', () => {
  it('moves one handle', () => {
    expect(moveHandle([0, 10], 'from', 7.5)).toEqual([7.5, 10])
    expect(moveHandle([7.5, 10], 'to', 8)).toEqual([7.5, 8])
  })

  it('does not let the handles cross', () => {
    expect(moveHandle([7.5, 8], 'from', 9)).toEqual([8, 8])
    expect(moveHandle([7.5, 8], 'to', 6)).toEqual([7.5, 7.5])
  })
})

describe('rangeText', () => {
  it('names the chosen range, any at full width', () => {
    expect(rangeText([0, 10])).toBe('any')
    expect(rangeText([7.5, 10])).toBe('7.5 – 10.0')
    expect(rangeText([6, 8])).toBe('6.0 – 8.0')
  })
})
