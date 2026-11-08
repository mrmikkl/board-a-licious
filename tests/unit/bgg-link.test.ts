import { describe, expect, it } from 'vitest'

import { gameUrl, parseBggCollectionLink, parseGameLink } from '../../src/domain/bgg-link.ts'

describe('BGG game links', () => {
  it.each([
    ['https://boardgamegeek.com/boardgame/342942/ark-nova', 342942, 'Ark Nova'],
    ['boardgamegeek.com/boardgame/295947/cascadia', 295947, 'Cascadia'],
    ['https://www.boardgamegeek.com/boardgame/295947', 295947, ''],
    ['http://boardgamegeek.com/boardgameexpansion/400314/cascadia-landmarks', 400314, 'Cascadia Landmarks'],
    ['https://boardgamegeek.com/boardgame/295947/cascadia/files', 295947, 'Cascadia'],
    ['Look at this! https://boardgamegeek.com/boardgame/224517/brass-birmingham?utm=x', 224517, 'Brass Birmingham'],
  ])('reads %s', (text, bggId, suggestedName) => {
    expect(parseGameLink(text)).toEqual({ ok: true, bggId, suggestedName })
  })

  it.each([
    ['https://boardgamegeek.com/geeklist/12345/my-list', /game link/i],
    ['https://boardgamegeek.com/geekpreview/93/spiel-essen-2026', /game link/i],
    ['https://example.com/boardgame/1/x', /boardgamegeek/i],
    ['ark nova', /boardgamegeek/i],
    ['', /paste/i],
  ])('rejects %s with a hint', (text, hint) => {
    const result = parseGameLink(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(hint)
  })

  it('builds the link to a game', () => {
    expect(gameUrl(295947)).toBe('https://boardgamegeek.com/boardgame/295947')
  })
})

describe('BGG collection links (FR-007)', () => {
  const base = 'https://boardgamegeek.com/collection/user/Anna'
  it.each([
    ['own', 'own'],
    ['wishlist', 'wishlist'],
    ['wanttoplay', 'wantToPlay'],
    ['trade', 'forTrade'],
    ['want', 'wantInTrade'],
    ['wanttobuy', 'wantToBuy'],
    ['preordered', 'preordered'],
    ['prevowned', 'prevOwned'],
  ])('reads the status parameter %s', (param, status) => {
    expect(parseBggCollectionLink(`${base}?subtype=boardgame&${param}=1&ff=1`)).toEqual({ bggUser: 'anna', status })
  })

  it('without a status filter it is the whole collection', () => {
    expect(parseBggCollectionLink(base)).toEqual({ bggUser: 'anna' })
    expect(parseBggCollectionLink(`${base}?subtype=boardgame&own=0`)).toEqual({ bggUser: 'anna' })
  })

  it('decodes and lower-cases names, allows www. and surrounding text', () => {
    expect(parseBggCollectionLink('https://www.boardgamegeek.com/collection/user/Big%20Ben?wishlist=1')).toEqual({ bggUser: 'big ben', status: 'wishlist' })
    expect(parseBggCollectionLink('see boardgamegeek.com/collection/user/Anna/ ok')).toEqual({ bggUser: 'anna' })
  })

  it.each([
    'https://example.com/collection/user/anna?own=1',
    'https://boardgamegeek.com.evil.com/collection/user/anna',
    'https://boardgamegeek.com/user/anna',
    'https://boardgamegeek.com/collection/user/',
    'https://boardgamegeek.com/geeklist/12345',
    'https://boardgamegeek.com/boardgame/342942/ark-nova',
    'anna',
    '',
  ])('ignores %s', text => {
    expect(parseBggCollectionLink(text)).toBeNull()
  })
})
