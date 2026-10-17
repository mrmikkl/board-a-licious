import { describe, expect, it } from 'vitest'

import { parseListLink } from '../../src/domain/lists.ts'

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
