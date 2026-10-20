import { describe, expect, it } from 'vitest'

import { type Swipe, dragEffect, moveSwipe, pinchSwipe, releaseSwipe, startSwipe } from '../../src/app/viewer-gesture.ts'

/** A finger that went down at (100, 300) at t=0 and is now at (100 + dx, 300 + dy) at t=ms. */
const drag = (dx: number, dy: number, ms = 200): Swipe => moveSwipe(startSwipe(100, 300, 0), 100 + dx, 300 + dy, ms)

describe('viewer gestures (research R5)', () => {
  it('locks the axis only after 8px, from the dominant direction', () => {
    expect(drag(5, 4).axis).toBeNull()
    expect(dragEffect(drag(5, 4), 0, 8)).toEqual({ kind: 'none' })
    expect(drag(20, 4).axis).toBe('x')
    expect(drag(-3, 30).axis).toBe('y')
    // once locked, the axis stays even when the finger wanders
    expect(moveSwipe(drag(20, 4), 120, 400, 300).axis).toBe('x')
  })

  it('moves the track with the finger sideways, a third of the way past the first or last image', () => {
    expect(dragEffect(drag(-60, 2), 2, 8)).toEqual({ kind: 'drag-x', offset: -60 })
    expect(dragEffect(drag(60, 2), 2, 8)).toEqual({ kind: 'drag-x', offset: 60 })
    expect(dragEffect(drag(60, 2), 0, 8)).toEqual({ kind: 'drag-x', offset: 20 })
    expect(dragEffect(drag(-90, 2), 7, 8)).toEqual({ kind: 'drag-x', offset: -30 })
    expect(dragEffect(drag(-90, 2), 0, 1)).toEqual({ kind: 'drag-x', offset: -30 })
  })

  it('steps on release after a long enough drag or a flick, never past the ends', () => {
    expect(releaseSwipe(drag(-80, 0, 400), 2, 8)).toEqual({ kind: 'step', delta: 1 })
    expect(releaseSwipe(drag(80, 0, 400), 2, 8)).toEqual({ kind: 'step', delta: -1 })
    expect(releaseSwipe(drag(-40, 0, 400), 2, 8)).toEqual({ kind: 'settle' })
    // a flick: faster than 0.5 px/ms
    expect(releaseSwipe(drag(-30, 0, 40), 2, 8)).toEqual({ kind: 'step', delta: 1 })
    expect(releaseSwipe(drag(30, 0, 40), 2, 8)).toEqual({ kind: 'step', delta: -1 })
    // a twitch is never a flick
    expect(releaseSwipe(drag(-10, 0, 1), 2, 8)).toEqual({ kind: 'settle' })
    // the ends: spring back
    expect(releaseSwipe(drag(120, 0, 100), 0, 8)).toEqual({ kind: 'settle' })
    expect(releaseSwipe(drag(-120, 0, 100), 7, 8)).toEqual({ kind: 'settle' })
    expect(releaseSwipe(drag(-120, 0, 100), 0, 1)).toEqual({ kind: 'settle' })
  })

  it('moves the image down with the finger and fades the backdrop; up does nothing', () => {
    expect(dragEffect(drag(2, 80), 0, 8)).toEqual({ kind: 'drag-y', offset: 80, backdrop: 0.8 })
    expect(dragEffect(drag(2, 400), 0, 8)).toEqual({ kind: 'drag-y', offset: 400, backdrop: 0.3 })
    expect(dragEffect(drag(2, -80), 0, 8)).toEqual({ kind: 'drag-y', offset: 0, backdrop: 1 })
  })

  it('closes on release after 100px down or a flick down, else settles', () => {
    expect(releaseSwipe(drag(0, 140, 500), 0, 8)).toEqual({ kind: 'close' })
    expect(releaseSwipe(drag(0, 60, 500), 0, 8)).toEqual({ kind: 'settle' })
    expect(releaseSwipe(drag(0, 40, 50), 0, 8)).toEqual({ kind: 'close' })
    expect(releaseSwipe(drag(0, -140, 100), 0, 8)).toEqual({ kind: 'settle' })
  })

  it('ignores the gesture while two pointers are down (pinch zoom)', () => {
    const pinch = moveSwipe(pinchSwipe(drag(20, 0)), 200, 300, 300)
    expect(dragEffect(pinch, 2, 8)).toEqual({ kind: 'ignore' })
    expect(releaseSwipe(pinch, 2, 8)).toEqual({ kind: 'ignore' })
    expect(releaseSwipe(startSwipe(100, 300, 0), 2, 8)).toEqual({ kind: 'settle' })
  })
})
