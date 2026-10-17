import { describe, expect, it } from 'vitest'

import { type Entry, newEntry, validateEntry } from '../../src/domain/collection.ts'
import { factsFromList, factsRule, refreshPreviewFacts, setManualFacts } from '../../src/domain/facts.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'

const listFacts = { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisherId: 34183, publisher: 'Inside Up Games' }

describe('facts rule (FR-010)', () => {
  it('keeps facts only from a preview into an Essen collection', () => {
    expect(factsRule(true, 'essen')).toEqual({ keep: true, reason: 'Booth, price and publisher are kept' })
  })

  it.each([
    [true, 'standard', 'Added without booth and price: standard collection'],
    [false, 'essen', 'Added without booth and price: this list has none'],
    [false, 'standard', 'Added without booth and price: this list has none'],
  ] as const)('says why for list isEssen=%s into %s', (isEssen, type, reason) => {
    expect(factsRule(isEssen, type)).toEqual({ keep: false, reason })
  })

  it('copies booth, price and publisher without the company id, marked as preview facts', () => {
    expect(factsFromList(listFacts, true, 'essen')).toEqual({
      facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games' },
      factsSource: 'preview',
    })
  })

  it('adds without facts in every other combination', () => {
    expect(factsFromList(listFacts, true, 'standard')).toEqual({ facts: null, factsSource: null })
    expect(factsFromList(undefined, false, 'essen')).toEqual({ facts: null, factsSource: null })
    expect(factsFromList(undefined, true, 'essen')).toEqual({ facts: null, factsSource: null })
  })
})

describe('manual facts (FR-011)', () => {
  it('marks facts typed in by hand as manual', () => {
    const entry = setManualFacts(newEntry('c1', 1, T1), { booth: ' 2-B10 ', priceCents: 3500, currency: 'EUR', publisher: 'Feuerland' }, T2)
    expect(entry).toMatchObject({
      facts: { booth: '2-B10', priceCents: 3500, currency: 'EUR', publisher: 'Feuerland' },
      factsSource: 'manual',
      updatedAt: T2,
    })
    expect(validateEntry(entry)).toBeNull()
  })

  it('also turns preview facts into manual ones when edited', () => {
    const preview: Entry = { ...newEntry('c1', 1, T1), facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: null }, factsSource: 'preview' }
    expect(setManualFacts(preview, { booth: '3-R401' }, T2)).toMatchObject({ facts: { booth: '3-R401' }, factsSource: 'manual' })
  })

  it('clears facts when every part is empty', () => {
    expect(setManualFacts(newEntry('c1', 1, T1), { booth: '  ', priceCents: null, publisher: '' }, T2)).toMatchObject({
      facts: null,
      factsSource: null,
    })
  })
})

describe('refreshing preview facts', () => {
  const preview = (patch: Partial<Entry> = {}): Entry => ({
    ...newEntry('c1', 446453, T1),
    facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: null },
    factsSource: 'preview',
    ...patch,
  })
  const fresh = new Map([[446453, { booth: '3-R401', priceCents: 5500, currency: 'EUR', publisherId: 34183, publisher: 'Inside Up Games' }]])

  it('updates booth, price and publisher of preview facts', () => {
    expect(refreshPreviewFacts([preview()], fresh, T2)).toEqual([
      preview({ facts: { booth: '3-R401', priceCents: 5500, currency: 'EUR', publisher: 'Inside Up Games' }, updatedAt: T2 }),
    ])
  })

  it('never touches manual facts, removed entries, other games or unchanged facts', () => {
    const manual = preview({ factsSource: 'manual' })
    const removed = preview({ deleted: true })
    const other = preview({ bggId: 1 })
    const same = preview({ facts: { booth: '3-R401', priceCents: 5500, currency: 'EUR', publisher: 'Inside Up Games' } })
    expect(refreshPreviewFacts([manual, removed, other, same], fresh, T2)).toEqual([])
  })

  it('keeps a known publisher when the list has none yet', () => {
    const named = preview({ facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games' } })
    const update = new Map([[446453, { ...fresh.get(446453)!, publisher: null }]])
    expect(refreshPreviewFacts([named], update, T2)[0]?.facts?.publisher).toBe('Inside Up Games')
  })
})
