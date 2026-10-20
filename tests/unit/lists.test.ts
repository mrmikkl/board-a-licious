import { describe, expect, it } from 'vitest'

import { SPIEL_PREVIEW_LINK, mergeListEntries, parseListLink, suggestSpielPreview } from '../../src/domain/lists.ts'

describe('BGG list links', () => {
  it.each([
    ['https://boardgamegeek.com/geekpreview/93/spiel-essen-2026', 'preview', 93],
    ['boardgamegeek.com/geekpreview/93', 'preview', 93],
    ['https://www.boardgamegeek.com/geekpreview/93/spiel-essen-2026/item/24066?sort=hot', 'preview', 93],
    ['https://boardgamegeek.com/geeklist/66420/metalist-for-geeklist-auctions', 'geeklist', 66420],
    ['http://boardgamegeek.com/geeklist/365010', 'geeklist', 365010],
    ['Our picks: https://boardgamegeek.com/geeklist/365010/friends-picks?page=2 see you there', 'geeklist', 365010],
  ])('reads %s', (text, kind, id) => {
    expect(parseListLink(text)).toEqual({ kind, id })
  })

  it.each([
    '',
    'spiel essen',
    'https://boardgamegeek.com/boardgame/295947/cascadia',
    'https://boardgamegeek.com/geeklist/',
    'https://boardgamegeek.com/geeklist/0/empty',
    'https://example.com/geeklist/66420/x',
    'https://boardgamegeek.com/geekpreview/abc',
  ])('rejects %s', text => {
    expect(parseListLink(text)).toBeNull()
  })
})

describe('one row per game (a preview lists one item per edition or publisher)', () => {
  const item = (position: number, bggId: number, facts: Record<string, unknown> | undefined, name = `Game ${bggId}`) => ({
    position,
    bggId,
    name,
    thumbnailUrl: null,
    facts: facts as never,
  })

  it('merges editions of the same game at its first position, keeping every booth and publisher', () => {
    const merged = mergeListEntries([
      item(1, 463296, { booth: '7-C111', priceCents: null, currency: null, publisherId: 1, publisher: 'Lookout Games' }),
      item(2, 2, { booth: '1-A1', priceCents: 1000, currency: 'EUR', publisherId: 2, publisher: 'Other' }),
      item(9, 463296, { booth: '3-V300', priceCents: 4500, currency: 'EUR', publisherId: 1, publisher: 'Lookout Games' }),
      item(12, 405769, { booth: '4-E400', priceCents: null, currency: null, publisherId: 3, publisher: 'Ruse.Games' }),
      item(15, 405769, { booth: null, priceCents: null, currency: null, publisherId: 4, publisher: 'HABA' }),
    ])
    expect(merged.map(e => [e.position, e.bggId])).toEqual([
      [1, 463296],
      [2, 2],
      [12, 405769],
    ])
    expect(merged[0]?.facts).toEqual({ booth: '7-C111 / 3-V300', priceCents: 4500, currency: 'EUR', publisherId: 1, publisher: 'Lookout Games', edition: null })
    expect(merged[2]?.facts).toEqual({ booth: '4-E400', priceCents: null, currency: null, publisherId: 3, publisher: 'Ruse.Games, HABA', edition: null })
  })

  it('leaves lists without duplicates and without facts (geeklists) as they are', () => {
    const plain = [item(1, 1, undefined), item(2, 2, undefined)]
    expect(mergeListEntries(plain)).toEqual(plain)
  })
})

describe('the SPIEL Essen 2026 preview suggestion', () => {
  it('is a valid preview link', () => {
    expect(parseListLink(SPIEL_PREVIEW_LINK)).toEqual({ kind: 'preview', id: 93 })
  })
  it('is suggested until that preview is on the device', () => {
    expect(suggestSpielPreview([])).toBe(true)
    expect(suggestSpielPreview([{ kind: 'geeklist', id: 93 }, { kind: 'preview', id: 9093 }])).toBe(true)
    expect(suggestSpielPreview([{ kind: 'preview', id: 93 }])).toBe(false)
  })
})

