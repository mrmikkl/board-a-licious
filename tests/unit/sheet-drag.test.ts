import { describe, expect, it } from 'vitest'

import { shouldClose } from '../../src/app/components/sheet-drag.ts'

describe('closing a sheet by pulling it down', () => {
  it('closes after a long enough pull or a quick flick, never on an upward move', () => {
    expect(shouldClose(120, 600)).toBe(true)
    expect(shouldClose(60, 60)).toBe(true)
    expect(shouldClose(40, 400)).toBe(false)
    expect(shouldClose(30, 1)).toBe(false)
    expect(shouldClose(-150, 100)).toBe(false)
  })
})
