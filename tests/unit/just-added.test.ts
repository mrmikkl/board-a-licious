import { afterEach, describe, expect, it } from 'vitest'

import { clearJustAddedOn, justAddedIn, markJustAdded, subscribeJustAdded } from '../../src/app/just-added.ts'

/** F002 T010: the row just added keeps the hover highlight until the user scrolls or taps elsewhere. */
describe('just added', () => {
  const cleanups: (() => void)[] = []
  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup())
    // start each test with nothing marked
    const target = new EventTarget()
    clearJustAddedOn(target)
    target.dispatchEvent(new Event('pointerdown'))
  })

  it('remembers the game for its collection only', () => {
    markJustAdded('c1', 295947)
    expect(justAddedIn('c1')).toBe(295947)
    expect(justAddedIn('c2')).toBeUndefined()
    markJustAdded('c2', 13)
    expect(justAddedIn('c1')).toBeUndefined()
    expect(justAddedIn('c2')).toBe(13)
  })

  it('tells subscribers when it changes', () => {
    let calls = 0
    cleanups.push(subscribeJustAdded(() => calls++))
    markJustAdded('c1', 295947)
    expect(calls).toBe(1)
  })

  it.each(['scroll', 'pointerdown'])('clears on the first %s and notifies once', type => {
    const target = new EventTarget()
    markJustAdded('c1', 295947)
    let calls = 0
    cleanups.push(subscribeJustAdded(() => calls++))
    cleanups.push(clearJustAddedOn(target))
    target.dispatchEvent(new Event(type))
    expect(justAddedIn('c1')).toBeUndefined()
    expect(calls).toBe(1)
    target.dispatchEvent(new Event(type))
    expect(calls).toBe(1)
  })

  it('stops listening when cleaned up', () => {
    const target = new EventTarget()
    markJustAdded('c1', 295947)
    clearJustAddedOn(target)()
    target.dispatchEvent(new Event('pointerdown'))
    expect(justAddedIn('c1')).toBe(295947)
  })
})
