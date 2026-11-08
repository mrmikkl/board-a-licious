import { describe, expect, it } from 'vitest'

import { loadedAgo } from '../../src/app/loaded-ago.ts'

const NOW = Date.parse('2026-11-08T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const MIN = 60_000

describe('loadedAgo (docs/design.md "Status list": "loaded 12 min ago")', () => {
  it.each([
    [ago(20_000), 'loaded just now'],
    [ago(MIN), 'loaded 1 min ago'],
    [ago(12 * MIN), 'loaded 12 min ago'],
    [ago(59 * MIN), 'loaded 59 min ago'],
    [ago(60 * MIN), 'loaded 1 h ago'],
    [ago(2 * 60 * MIN + 10 * MIN), 'loaded 2 h ago'],
    [ago(23 * 60 * MIN), 'loaded 23 h ago'],
    [ago(24 * 60 * MIN), 'loaded 1 day ago'],
    [ago(3 * 24 * 60 * MIN), 'loaded 3 days ago'],
  ])('%s → %s', (iso, text) => expect(loadedAgo(iso, NOW)).toBe(text))

  it('a time in the future (another clock) counts as just now; none is "not loaded yet"', () => {
    expect(loadedAgo(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe('loaded just now')
    expect(loadedAgo(null, NOW)).toBe('not loaded yet')
    expect(loadedAgo('nonsense', NOW)).toBe('not loaded yet')
  })
})
