import { describe, expect, it } from 'vitest'

import { ROW_INFOS, gameInfos, publisherOf, rowInfos } from '../../src/domain/game-info.ts'

const details = { minPlayers: 1, maxPlayers: 4, designers: ['Randy Flynn', 'Ann Other'], mechanisms: ['Chaining', 'Hexagon Grid'], publisher: 'Flatout Games' }
const facts = { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', edition: 'English edition' }

describe('game info (FR-010)', () => {
  it('lists price, players, booth, edition, designer, mechanisms in this order', () => {
    expect(gameInfos(facts, details)).toEqual([
      { key: 'price', label: 'Price', text: '€60' },
      { key: 'players', label: 'Players', text: '1–4 players' },
      { key: 'booth', label: 'Booth', text: 'Booth 3-R400' },
      { key: 'edition', label: 'Edition', text: 'English edition' },
      { key: 'designer', label: 'Designer', text: 'Randy Flynn, Ann Other' },
      { key: 'mechanisms', label: 'Mechanisms', text: 'Chaining, Hexagon Grid', items: ['Chaining', 'Hexagon Grid'] },
    ])
  })

  it('skips what is not known', () => {
    expect(gameInfos({ booth: null, priceCents: null, edition: '' }, { minPlayers: 2, maxPlayers: 2, designers: [], mechanisms: [] }).map(i => i.text)).toEqual([
      '2 players',
    ])
    expect(gameInfos(null, undefined)).toEqual([])
  })

  it('says "2+ players" or "up to 5 players" when only one bound is known', () => {
    expect(gameInfos(null, { minPlayers: 2, maxPlayers: null })[0]?.text).toBe('2+ players')
    expect(gameInfos(null, { minPlayers: null, maxPlayers: 5 })[0]?.text).toBe('up to 5 players')
    expect(gameInfos(null, { minPlayers: 1, maxPlayers: 1 })[0]?.text).toBe('1 player')
  })

  it('ignores designers or mechanisms that are not lists (never breaks a row)', () => {
    expect(gameInfos(null, { designers: '["A"]' as never, mechanisms: null as never })).toEqual([])
  })

  it('rows show the first three available', () => {
    expect(ROW_INFOS).toBe(3)
    expect(rowInfos(facts, details).map(i => i.key)).toEqual(['price', 'players', 'booth'])
    expect(rowInfos({ edition: 'German edition' }, details).map(i => i.key)).toEqual(['players', 'edition', 'designer'])
  })

  it('takes the publisher from the list, else the first BGG publisher', () => {
    expect(publisherOf(facts, details)).toBe('Inside Up Games')
    expect(publisherOf({ booth: 'X' }, details)).toBe('Flatout Games')
    expect(publisherOf(null, undefined)).toBeNull()
  })
})
