import { describe, expect, it } from 'vitest'

import { matchesName } from '../../src/domain/search.ts'

describe('F005 search by name (FR-018, research R7)', () => {
  it('ignores case and accents', () => {
    expect(matchesName('Cascadia', 'CAS')).toBe(true)
    expect(matchesName('Café International', 'cafe')).toBe(true)
    expect(matchesName('Cafe International', 'café')).toBe(true)
    expect(matchesName('Azul', 'cas')).toBe(false)
  })

  it('matches every name for an empty or blank query and trims the query', () => {
    expect(matchesName('Azul', '')).toBe(true)
    expect(matchesName('Azul', '   ')).toBe(true)
    expect(matchesName('Sky Team', '  sky ')).toBe(true)
  })
})
