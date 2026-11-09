import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GAME_FILTER,
  DEFAULT_LENGTH_LIMITS,
  type FilterDetails,
  type GameFilter,
  fromStoredGameFilter,
  isDefaultGameFilter,
  lengthOf,
  lengthRanges,
  matchesGame,
  missingCounts,
  toStoredGameFilter,
  validLengthLimits,
  valueCounts,
} from '../../src/domain/game-filter.ts'
import type { PlayerVotes } from '../../src/domain/player-poll.ts'

const L = DEFAULT_LENGTH_LIMITS
const filter = (patch: Partial<GameFilter>): GameFilter => ({ ...DEFAULT_GAME_FILTER, ...patch })

/** Cascadia's poll (tests/fixtures/bgg-xml/thing-295947-385318.xml): best 2–3, recommended 1 and 4. */
const cascadiaPoll: PlayerVotes[] = [
  { players: '1', best: 133, recommended: 439, notRecommended: 145 },
  { players: '2', best: 587, recommended: 334, notRecommended: 17 },
  { players: '3', best: 551, recommended: 324, notRecommended: 17 },
  { players: '4', best: 188, recommended: 552, notRecommended: 82 },
  { players: '4+', best: 2, recommended: 37, notRecommended: 455 },
]
const cascadia: FilterDetails = {
  playingTime: 45,
  rating: 7.88,
  geekRating: 7.73,
  playerPoll: cascadiaPoll,
  mechanisms: ['Hexagon Grid', 'Tile Placement', 'Drafting'],
  designers: ['Randy Flynn'],
}
const bare: FilterDetails = { playingTime: null, rating: null, geekRating: null, playerPoll: [], mechanisms: [], designers: [] }

describe('length ranges', () => {
  it('has four ranges from the three limits, with their texts', () => {
    expect(DEFAULT_LENGTH_LIMITS).toEqual([30, 60, 120])
    expect(lengthRanges([30, 60, 120])).toEqual([
      { range: 'short', name: 'Short', text: '0–30 min' },
      { range: 'middle', name: 'Middle', text: '31–60 min' },
      { range: 'long', name: 'Long', text: '61–120 min' },
      { range: 'veryLong', name: 'Very long', text: '121+ min' },
    ])
    expect(lengthRanges([20, 45, 90]).map(r => r.text)).toEqual(['0–20 min', '21–45 min', '46–90 min', '91+ min'])
  })

  it('puts a length into its range; no or zero length has none', () => {
    expect([1, 30, 31, 60, 61, 120, 121, 600].map(m => lengthOf(m, L))).toEqual(['short', 'short', 'middle', 'middle', 'long', 'long', 'veryLong', 'veryLong'])
    expect(lengthOf(null, L)).toBeNull()
    expect(lengthOf(undefined, L)).toBeNull()
    expect(lengthOf(0, L)).toBeNull()
  })

  it('accepts only three increasing whole numbers of 1–600 as limits', () => {
    expect(validLengthLimits([30, 60, 120])).toBe(true)
    expect(validLengthLimits([1, 2, 600])).toBe(true)
    for (const bad of [[30, 60], [30, 60, 120, 240], [60, 30, 120], [30, 30, 120], [0, 60, 120], [30, 60, 601], [30.5, 60, 120], ['30', 60, 120], null, undefined, 'x', {}])
      expect(validLengthLimits(bad)).toBe(false)
  })
})

describe('matchesGame', () => {
  it('matches every game with the default filter, also without details', () => {
    expect(matchesGame(cascadia, DEFAULT_GAME_FILTER, L)).toBe(true)
    expect(matchesGame(bare, DEFAULT_GAME_FILTER, L)).toBe(true)
    expect(matchesGame(undefined, DEFAULT_GAME_FILTER, L)).toBe(true)
  })

  it('matches nothing without details once a section is set', () => {
    expect(matchesGame(undefined, filter({ length: ['middle'] }), L)).toBe(false)
    expect(matchesGame(undefined, filter({ rating: [7, 10] }), L)).toBe(false)
  })

  it('length: any ticked range (OR); the limits decide', () => {
    expect(matchesGame(cascadia, filter({ length: ['middle'] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ length: ['short'] }), L)).toBe(false)
    expect(matchesGame(cascadia, filter({ length: ['short', 'middle'] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ length: ['short'] }), [45, 60, 120])).toBe(true)
    expect(matchesGame(bare, filter({ length: ['short', 'middle', 'long', 'veryLong'] }), L)).toBe(false)
    expect(matchesGame({ ...cascadia, playingTime: undefined }, filter({ length: ['middle'] }), L)).toBe(false)
  })

  it('players: best or recommended with n by default, one kind narrows to it', () => {
    const both = (n: number) => filter({ players: { n, kinds: ['best', 'rec'] } })
    expect([1, 2, 3, 4, 5].map(n => matchesGame(cascadia, both(n), L))).toEqual([true, true, true, true, false])
    const best = (n: number) => filter({ players: { n, kinds: ['best'] } })
    expect([1, 2, 3, 4].map(n => matchesGame(cascadia, best(n), L))).toEqual([false, true, true, false])
    const rec = (n: number) => filter({ players: { n, kinds: ['rec'] } })
    expect([1, 2, 3, 4].map(n => matchesGame(cascadia, rec(n), L))).toEqual([true, false, false, true])
  })

  it('players: a game nobody voted on for n does not match', () => {
    expect(matchesGame(bare, filter({ players: { n: 2, kinds: ['best', 'rec'] } }), L)).toBe(false)
    expect(matchesGame({ ...cascadia, playerPoll: null }, filter({ players: { n: 2, kinds: ['best', 'rec'] } }), L)).toBe(false)
  })

  it('rating and geek rating: from and to inclusive; 0–10 is no filter; no rating does not match', () => {
    expect(matchesGame(cascadia, filter({ rating: [7.5, 10] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ rating: [7.9, 10] }), L)).toBe(false)
    expect(matchesGame(cascadia, filter({ rating: [0, 7.88] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ rating: [0, 7.8] }), L)).toBe(false)
    expect(matchesGame(cascadia, filter({ geekRating: [7.7, 7.8] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ geekRating: [7.8, 10] }), L)).toBe(false)
    expect(matchesGame(bare, filter({ rating: [0, 10] }), L)).toBe(true)
    expect(matchesGame(bare, filter({ rating: [0, 9.9] }), L)).toBe(false)
    expect(matchesGame(bare, filter({ geekRating: [0.1, 10] }), L)).toBe(false)
  })

  it('mechanisms and designers: every ticked value (AND)', () => {
    expect(matchesGame(cascadia, filter({ mechanisms: ['Drafting'] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ mechanisms: ['Drafting', 'Tile Placement'] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ mechanisms: ['Drafting', 'Cooperative Game'] }), L)).toBe(false)
    expect(matchesGame(cascadia, filter({ designers: ['Randy Flynn'] }), L)).toBe(true)
    expect(matchesGame(cascadia, filter({ designers: ['Uwe Rosenberg'] }), L)).toBe(false)
    expect(matchesGame(bare, filter({ mechanisms: ['Drafting'] }), L)).toBe(false)
  })

  it('sections combine with AND', () => {
    const f = filter({ length: ['middle'], players: { n: 3, kinds: ['best'] }, rating: [7.5, 10], mechanisms: ['Drafting'], designers: ['Randy Flynn'] })
    expect(matchesGame(cascadia, f, L)).toBe(true)
    expect(matchesGame({ ...cascadia, playingTime: 90 }, f, L)).toBe(false)
    expect(matchesGame({ ...cascadia, designers: [] }, f, L)).toBe(false)
  })
})

describe('counts for the sheet', () => {
  const games: FilterDetails[] = [
    cascadia,
    { ...bare, mechanisms: ['Drafting', 'Cooperative Game'], designers: ['Uwe Rosenberg'], playingTime: 90, rating: 7.1 },
    { ...bare, mechanisms: ['Cooperative Game', 'Hand Management'], designers: ['Uwe Rosenberg', 'Randy Flynn'] },
    bare,
    undefined,
  ]

  it('counts the values of mechanisms and designers, most common first, then by name', () => {
    expect(valueCounts(games, 'mechanisms')).toEqual([
      { value: 'Cooperative Game', count: 2 },
      { value: 'Drafting', count: 2 },
      { value: 'Hand Management', count: 1 },
      { value: 'Hexagon Grid', count: 1 },
      { value: 'Tile Placement', count: 1 },
    ])
    expect(valueCounts(games, 'designers')).toEqual([
      { value: 'Randy Flynn', count: 2 },
      { value: 'Uwe Rosenberg', count: 2 },
    ])
  })

  it('counts the games without the value each section needs', () => {
    expect(missingCounts(games, DEFAULT_GAME_FILTER)).toEqual({ length: 3, players: 4, rating: 3, geekRating: 4 })
    // Cascadia has votes for 5 (its "4+" row), though not recommended: that is a value, not a missing one
    expect(missingCounts(games, filter({ players: { n: 5, kinds: ['best', 'rec'] } })).players).toBe(4)
    const twoOnly: FilterDetails = { ...bare, playerPoll: [{ players: '2', best: 3, recommended: 1, notRecommended: 0 }] }
    expect(missingCounts([twoOnly], filter({ players: { n: 2, kinds: ['best', 'rec'] } })).players).toBe(0)
    expect(missingCounts([twoOnly], filter({ players: { n: 3, kinds: ['best', 'rec'] } })).players).toBe(1)
  })
})

describe('default and stored filter', () => {
  it('knows the default filter', () => {
    expect(isDefaultGameFilter(DEFAULT_GAME_FILTER)).toBe(true)
    expect(isDefaultGameFilter(filter({ rating: [0, 10], length: [] }))).toBe(true)
    expect(isDefaultGameFilter(filter({ length: ['short'] }))).toBe(false)
    expect(isDefaultGameFilter(filter({ players: { n: 2, kinds: ['best', 'rec'] } }))).toBe(false)
    expect(isDefaultGameFilter(filter({ geekRating: [0, 9.9] }))).toBe(false)
    expect(isDefaultGameFilter(filter({ designers: ['Randy Flynn'] }))).toBe(false)
  })

  it('stores only what is set and reads it back', () => {
    expect(toStoredGameFilter(DEFAULT_GAME_FILTER)).toEqual({})
    const f = filter({ length: ['short', 'veryLong'], players: { n: 10, kinds: ['rec'] }, rating: [7.5, 10], geekRating: [6, 8.2], mechanisms: ['Drafting'], designers: ['Randy Flynn'] })
    const stored = JSON.parse(JSON.stringify(toStoredGameFilter(f)))
    expect(fromStoredGameFilter(stored)).toEqual(f)
    expect(fromStoredGameFilter(toStoredGameFilter(filter({ mechanisms: ['Drafting'] })))).toEqual(filter({ mechanisms: ['Drafting'] }))
  })

  it('reads missing or broken stored values as the default', () => {
    expect(fromStoredGameFilter(undefined)).toEqual(DEFAULT_GAME_FILTER)
    expect(fromStoredGameFilter(null)).toEqual(DEFAULT_GAME_FILTER)
    expect(
      fromStoredGameFilter({ length: ['short', 'eternal'], players: { n: 0, kinds: ['best'] }, rating: [8, 3], geekRating: 'x', mechanisms: ['Drafting', 4], designers: null }),
    ).toEqual(filter({ length: ['short'], mechanisms: ['Drafting'] }))
    expect(fromStoredGameFilter({ players: { n: 3, kinds: [] } })).toEqual(filter({ players: { n: 3, kinds: ['best', 'rec'] } }))
  })
})
