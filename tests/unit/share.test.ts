import { describe, expect, it } from 'vitest'

import { type Collection, type Entry, newEntry } from '../../src/domain/collection.ts'
import { formatMoney } from '../../src/domain/money.ts'
import { DEFAULT_SHARE_MARKS, shareGroups, shareText } from '../../src/domain/share.ts'

const T1 = '2026-10-17T09:00:00.000Z'

const essen: Collection = { id: 'c1', name: 'Essen 2026', type: 'essen', updatedAt: T1, deleted: false }
const standard: Collection = { id: 'c2', name: 'Wishlist', type: 'standard', updatedAt: T1, deleted: false }

const entry = (bggId: number, patch: Partial<Entry> = {}): Entry => ({ ...newEntry('c1', bggId, T1), ...patch })

const games = new Map([
  [446453, { name: 'Example Game', year: 2026 }],
  [123456, { name: 'Another Game', year: 2026 }],
  [414317, { name: 'Harmonies', year: 2024 }],
  [295947, { name: 'Cascadia', year: 2021 }],
  [342942, { name: 'Ark Nova', year: 2021 }],
])

const entries: Entry[] = [
  entry(414317, { mark: 'interested' }),
  entry(446453, { mark: 'must_have', bought: true, paidCents: 5200, paidCurrency: 'EUR', facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR' } }),
  entry(123456, { mark: 'must_have', facts: { booth: '1-A202', priceCents: 4500, currency: 'EUR' } }),
  entry(295947, { mark: 'new' }),
  entry(342942, { mark: 'poop' }),
]

describe('share text', () => {
  it('selects Must Have and Interested by default', () => {
    expect(DEFAULT_SHARE_MARKS).toEqual(['must_have', 'interested'])
  })

  it('matches the contract example for an Essen collection', () => {
    const result = shareText(essen, entries, DEFAULT_SHARE_MARKS, games)
    expect(result).toEqual({
      ok: true,
      text: [
        '🎲 Essen 2026',
        '',
        '⭐ Must Have (2)',
        '• ✅ Example Game – 3-R400, €60 – https://boardgamegeek.com/boardgame/446453',
        '• Another Game – 1-A202, €45 – https://boardgamegeek.com/boardgame/123456',
        '',
        '👀 Interested (1)',
        '• Harmonies – https://boardgamegeek.com/boardgame/414317',
      ].join('\n'),
    })
  })

  it('lets every group be chosen, including Not yet marked, and keeps mark order', () => {
    const result = shareText(essen, entries, ['poop', 'new', 'must_have'], games)
    if (!result.ok) throw new Error(result.reason)
    const headings = result.text.split('\n').filter(line => /\(\d+\)$/.test(line))
    expect(headings).toEqual(['⬡ Not yet marked (1)', '⭐ Must Have (2)', '💩 Poop (1)'])
    expect(result.text).toContain('• Cascadia – https://boardgamegeek.com/boardgame/295947')
  })

  it('sorts games by name within a group', () => {
    const many = [entry(342942, { mark: 'unsure' }), entry(295947, { mark: 'unsure' }), entry(414317, { mark: 'unsure' })]
    const result = shareText(essen, many, ['unsure'], games)
    if (!result.ok) throw new Error(result.reason)
    expect(result.text.split('\n').filter(l => l.startsWith('•')).map(l => l.split(' – ')[0])).toEqual([
      '• Ark Nova',
      '• Cascadia',
      '• Harmonies',
    ])
  })

  it('leaves out booth and price for standard collections but keeps ✅', () => {
    const own = entries.map(e => ({ ...e, collectionId: 'c2' }))
    const result = shareText(standard, own, ['must_have'], games)
    if (!result.ok) throw new Error(result.reason)
    expect(result.text).toBe(
      [
        '🎲 Wishlist',
        '',
        '⭐ Must Have (2)',
        '• Another Game – https://boardgamegeek.com/boardgame/123456',
        '• ✅ Example Game – https://boardgamegeek.com/boardgame/446453',
      ].join('\n'),
    )
  })

  it('shows only the parts of the facts that are known', () => {
    const partial = [
      entry(446453, { mark: 'must_have', facts: { booth: '3-R400' } }),
      entry(123456, { mark: 'must_have', facts: { priceCents: 1250, currency: 'USD' } }),
      entry(414317, { mark: 'must_have', facts: null }),
    ]
    const result = shareText(essen, partial, ['must_have'], games)
    if (!result.ok) throw new Error(result.reason)
    expect(result.text).toContain('• Another Game – $12.50 – https://boardgamegeek.com/boardgame/123456')
    expect(result.text).toContain('• Example Game – 3-R400 – https://boardgamegeek.com/boardgame/446453')
    expect(result.text).toContain('• Harmonies – https://boardgamegeek.com/boardgame/414317')
  })

  it('skips other collections, deleted entries and empty groups', () => {
    const mixed = [...entries, entry(1, { mark: 'unsure', collectionId: 'c2' }), entry(2, { mark: 'unsure', deleted: true })]
    const result = shareText(essen, mixed, ['must_have', 'unsure'], games)
    if (!result.ok) throw new Error(result.reason)
    expect(result.text).not.toContain('Unsure')
  })

  it('names games missing from the lookup by their BGG id', () => {
    const result = shareText(essen, [entry(999, { mark: 'must_have' })], ['must_have'], new Map())
    if (!result.ok) throw new Error(result.reason)
    expect(result.text).toContain('• BGG game 999 – https://boardgamegeek.com/boardgame/999')
  })

  it('is not shareable when nothing is selected', () => {
    expect(shareText(essen, entries, [], games)).toEqual({ ok: false, reason: 'Choose at least one group to share.' })
  })

  it('is not shareable when every selected group is empty', () => {
    expect(shareText(essen, entries, ['unsure', 'skip'], games)).toEqual({
      ok: false,
      reason: 'The chosen groups have no games.',
    })
  })

  it('counts the games per group for the checkboxes', () => {
    expect(shareGroups('c1', entries)).toEqual([
      { mark: 'new', label: 'Not yet marked', emoji: '⬡', count: 1 },
      { mark: 'must_have', label: 'Must Have', emoji: '⭐', count: 2 },
      { mark: 'interested', label: 'Interested', emoji: '👀', count: 1 },
      { mark: 'unsure', label: 'Unsure', emoji: '🤔', count: 0 },
      { mark: 'poop', label: 'Poop', emoji: '💩', count: 1 },
      { mark: 'skip', label: 'Not interested', emoji: '🛑', count: 0 },
    ])
  })
})

describe('money', () => {
  it('shows whole amounts without cents and others with two decimals (FR-007)', () => {
    expect(formatMoney(5200, 'EUR')).toBe('€52')
    expect(formatMoney(1250, 'EUR')).toBe('€12.50')
    expect(formatMoney(5, 'EUR')).toBe('€0.05')
  })

  it('uses the symbol of common currencies, else the code', () => {
    expect(formatMoney(4000, 'USD')).toBe('$40')
    expect(formatMoney(1999, 'GBP')).toBe('£19.99')
    expect(formatMoney(3000, 'CHF')).toBe('CHF 30')
  })

  it('treats a missing currency as EUR', () => {
    expect(formatMoney(6000, null)).toBe('€60')
  })
})
