import { describe, expect, it } from 'vitest'

import { type SearchResult, parseGameInput, rankResults, searchQuery } from '../../src/domain/bgg-search.ts'

const r = (bggId: number, name: string, kind: SearchResult['kind'] = 'boardgame'): SearchResult => ({ bggId, name, year: 2020, kind })

describe('searchQuery (F006 data-model SearchQuery)', () => {
  it('trims and collapses inner whitespace', () => {
    expect(searchQuery('  sky   team ')).toEqual({ ok: true, text: 'sky team', key: 'sky team' })
  })

  it('needs 2–100 characters', () => {
    expect(searchQuery('a')).toEqual({ ok: false, reason: 'short' })
    expect(searchQuery('    ')).toEqual({ ok: false, reason: 'short' })
    expect(searchQuery('ab').ok).toBe(true)
    expect(searchQuery('x'.repeat(100)).ok).toBe(true)
    expect(searchQuery('x'.repeat(101))).toEqual({ ok: false, reason: 'long' })
  })

  it('keys the cache in lower case', () => {
    expect(searchQuery('Cascadia')).toMatchObject({ text: 'Cascadia', key: 'cascadia' })
  })
})

describe('rankResults (research R5)', () => {
  const results = [
    r(154301, "The Battle at Kemble's Cascade"),
    r(401216, 'Cascadero'),
    r(295947, 'Cascadia'),
    r(385318, 'Cascadia: Landmarks', 'expansion'),
    r(433007, 'Cascadia Junior'),
    r(12786, 'Cascade'),
  ]

  it('puts exact matches first, then names starting with the text, then the rest; shorter names first', () => {
    expect(rankResults(results, 'cascadia', 3).map(g => g.name)).toEqual(['Cascadia', 'Cascadia Junior', 'Cascadia: Landmarks'])
    expect(rankResults(results, 'cascad', 50).map(g => g.name)).toEqual([
      'Cascade',
      'Cascadia',
      'Cascadero',
      'Cascadia Junior',
      'Cascadia: Landmarks',
      "The Battle at Kemble's Cascade",
    ])
  })

  it('sorts names of the same length alphabetically', () => {
    expect(rankResults([r(2, 'Abcd'), r(1, 'Abca')], 'ab', 50).map(g => g.bggId)).toEqual([1, 2])
  })

  it('ignores case and accents', () => {
    const games = [r(1, 'Tôkaidô Duo'), r(2, 'Tokaido')]
    expect(rankResults(games, 'TOKAIDO', 50).map(g => g.bggId)).toEqual([2, 1])
  })

  it('keeps games BGG matched elsewhere (other words, other names) after the rest', () => {
    expect(rankResults([r(1, 'Jeu des chapeaux'), r(2, 'Cascade')], 'cascad', 50).map(g => g.bggId)).toEqual([2, 1])
  })

  it('cuts at the limit', () => {
    expect(rankResults(results, 'cascad', 2).map(g => g.name)).toEqual(['Cascade', 'Cascadia'])
  })
})

describe('parseGameInput (research R9)', () => {
  it('is empty for blank text', () => {
    expect(parseGameInput('   ')).toEqual({ kind: 'empty' })
  })

  it('reads a BoardGameGeek link', () => {
    expect(parseGameInput('https://boardgamegeek.com/boardgame/295947/cascadia')).toEqual({
      kind: 'link',
      link: { ok: true, bggId: 295947, suggestedName: 'Cascadia' },
    })
  })

  it('keeps the message of a link that is no game', () => {
    const input = parseGameInput('https://boardgamegeek.com/geeklist/66420')
    expect(input.kind).toBe('link')
    expect(input.kind === 'link' && input.link.ok).toBe(false)
  })

  it('treats anything else as a name to search', () => {
    expect(parseGameInput(' harmon ')).toEqual({ kind: 'name', query: { ok: true, text: 'harmon', key: 'harmon' } })
    expect(parseGameInput('h')).toEqual({ kind: 'name', query: { ok: false, reason: 'short' } })
  })
})
