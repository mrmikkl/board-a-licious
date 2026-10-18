import { describe, expect, it } from 'vitest'

import { readShare } from '../../src/domain/shared.ts'

const CASCADIA = 'https://boardgamegeek.com/boardgame/295947/cascadia'

describe('reading a share (F002 research R4)', () => {
  it('finds a game link in url', () => {
    expect(readShare({ url: CASCADIA })).toEqual({ kind: 'game', bggId: 295947, suggestedName: 'Cascadia' })
  })

  it('finds a game link inside shared text with words around it', () => {
    expect(readShare({ text: `Check out Cascadia on BoardGameGeek: ${CASCADIA}` })).toMatchObject({ kind: 'game', bggId: 295947 })
  })

  it('recognises expansions', () => {
    expect(readShare({ url: 'https://boardgamegeek.com/boardgameexpansion/366161/cascadia-landmarks' })).toEqual({
      kind: 'game',
      bggId: 366161,
      suggestedName: 'Cascadia Landmarks',
    })
  })

  it('takes url before text before title', () => {
    const other = 'https://boardgamegeek.com/boardgame/446453/kalypso'
    expect(readShare({ url: other, text: CASCADIA })).toMatchObject({ bggId: 446453 })
    expect(readShare({ text: other, title: CASCADIA })).toMatchObject({ bggId: 446453 })
    expect(readShare({ title: CASCADIA })).toMatchObject({ bggId: 295947 })
  })

  it('opens shared lists', () => {
    expect(readShare({ url: 'https://boardgamegeek.com/geekpreview/93/spiel-essen-2026' })).toEqual({ kind: 'list', ref: { kind: 'preview', id: 93 } })
    expect(readShare({ text: 'look: https://boardgamegeek.com/geeklist/66420/top-games' })).toEqual({ kind: 'list', ref: { kind: 'geeklist', id: 66420 } })
  })

  it('says none for anything that is not a game or list, showing the link or the text', () => {
    const blog = 'https://boardgamegeek.com/blog/1/blogpost/171234/spiel-2026-news'
    expect(readShare({ url: blog })).toEqual({ kind: 'none', shown: blog })
    expect(readShare({ text: 'see https://boardgamegeek.com/thread/123/some-thread here' })).toEqual({
      kind: 'none',
      shown: 'https://boardgamegeek.com/thread/123/some-thread',
    })
    expect(readShare({ url: 'https://example.com/cascadia' })).toEqual({ kind: 'none', shown: 'https://example.com/cascadia' })
    expect(readShare({ text: 'just some words' })).toEqual({ kind: 'none', shown: 'just some words' })
    expect(readShare({})).toEqual({ kind: 'none', shown: '' })
    expect((readShare({ text: 'x'.repeat(500) }) as { shown: string }).shown).toHaveLength(200)
  })

  describe('suggested name', () => {
    it('comes from the page title without BGG suffixes', () => {
      expect(readShare({ title: 'Cascadia | Board Game | BoardGameGeek', url: CASCADIA })).toMatchObject({ suggestedName: 'Cascadia' })
      expect(readShare({ title: 'Ark Nova - BoardGameGeek', url: 'https://boardgamegeek.com/boardgame/342942/ark-nova' })).toMatchObject({
        suggestedName: 'Ark Nova',
      })
    })

    it('else from short plain text before the link', () => {
      expect(readShare({ text: `Cascadia ${CASCADIA}` })).toMatchObject({ suggestedName: 'Cascadia' })
      expect(readShare({ text: `Heat: Pedal to the Metal – https://boardgamegeek.com/boardgame/366013/heat-pedal-to-the-metal` })).toMatchObject({
        suggestedName: 'Heat: Pedal to the Metal',
      })
    })

    it('else from the slug, never empty', () => {
      expect(readShare({ text: `Check out this game I found on BoardGameGeek, it looks great for us: ${CASCADIA}` })).toMatchObject({
        suggestedName: 'Cascadia',
      })
      expect(readShare({ url: 'https://boardgamegeek.com/boardgame/12345' })).toMatchObject({ suggestedName: 'Game 12345' })
    })
  })
})
