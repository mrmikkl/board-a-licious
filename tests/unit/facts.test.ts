import { describe, expect, it } from 'vitest'

import { type Entry, type Facts, newEntry, validateEntry } from '../../src/domain/collection.ts'
import { type ListFacts, applyConflictChoices, factsFromList, reconcileFacts, refreshPreviewFacts, setManualFacts } from '../../src/domain/facts.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'

const listFacts = { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisherId: 34183, publisher: 'Inside Up Games' }

describe('facts from a list (FR-010)', () => {
  it('copies booth, price, publisher and edition without the company id, into any collection', () => {
    expect(factsFromList({ ...listFacts, edition: 'English edition' })).toEqual({
      facts: { booth: '3-R400', priceCents: 6000, currency: 'EUR', publisher: 'Inside Up Games', edition: 'English edition' },
      factsSource: 'preview',
    })
  })

  it('adds without facts when the list says nothing about the game', () => {
    expect(factsFromList(undefined)).toEqual({ facts: null, factsSource: null })
    expect(factsFromList({ booth: null, priceCents: null, publisherId: null })).toEqual({ facts: null, factsSource: null })
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
      preview({ facts: { booth: '3-R401', priceCents: 5500, currency: 'EUR', publisher: 'Inside Up Games', edition: null }, updatedAt: T2 }),
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

describe('reconciling a resynced list (US5, research R10)', () => {
  const T3 = '2026-10-23T09:00:00.000Z'
  const manual = (collectionId: string, facts: Facts, patch: Partial<Entry> = {}): Entry => ({
    ...newEntry(collectionId, 446453, T1),
    facts,
    factsSource: 'manual',
    ...patch,
  })
  const fresh = (facts: ListFacts) => new Map([[446453, facts]])
  // the other fields as the list has them, so a test only differs where it says so
  const same = { priceCents: 3000, currency: 'EUR', publisher: 'Feuerland' }
  const listed: ListFacts = { booth: '3-A100', priceCents: 3000, currency: 'EUR', publisherId: 34183, publisher: 'Feuerland', edition: null }

  it('takes list facts for an entry without facts, as preview', () => {
    const entry = newEntry('c1', 446453, T1)
    expect(reconcileFacts([entry], fresh(listed), {}, T3)).toEqual({
      updates: [{ ...entry, facts: { booth: '3-A100', priceCents: 3000, currency: 'EUR', publisher: 'Feuerland', edition: null }, factsSource: 'preview', updatedAt: T3 }],
      conflicts: [],
    })
  })

  it('leaves an entry alone when the list says nothing about the game', () => {
    expect(reconcileFacts([newEntry('c1', 446453, T1)], fresh({ publisherId: null }), {}, T3)).toEqual({ updates: [], conflicts: [] })
  })

  it('lets the list win for a preview entry', () => {
    const preview = { ...newEntry('c1', 446453, T1), facts: { booth: '2-B10', priceCents: 3000, currency: 'EUR' }, factsSource: 'preview' as const }
    const { updates, conflicts } = reconcileFacts([preview], fresh(listed), {}, T3)
    expect(updates).toMatchObject([{ facts: { booth: '3-A100' }, factsSource: 'preview', updatedAt: T3 }])
    expect(conflicts).toEqual([])
  })

  it('fills an empty field of a hand-typed entry and keeps its source manual', () => {
    const entry = manual('c1', { booth: '3-A100' })
    const { updates, conflicts } = reconcileFacts([entry], fresh(listed), {}, T3)
    expect(updates).toMatchObject([{ facts: { booth: '3-A100', priceCents: 3000, currency: 'EUR', publisher: 'Feuerland' }, factsSource: 'manual', updatedAt: T3 }])
    expect(conflicts).toEqual([])
  })

  it('makes a hand-typed field that differs from BGG a conflict and changes nothing', () => {
    const entry = manual('c1', { ...same, booth: '2-B10' })
    expect(reconcileFacts([entry], fresh(listed), {}, T3)).toEqual({
      updates: [],
      conflicts: [{ collectionId: 'c1', bggId: 446453, field: 'booth', own: '2-B10', bgg: '3-A100', bggFacts: { booth: '3-A100' } }],
    })
  })

  it('finds nothing where the hand-typed values equal BGG', () => {
    expect(reconcileFacts([manual('c1', { ...same, booth: '3-A100' })], fresh(listed), {}, T3)).toEqual({ updates: [], conflicts: [] })
  })

  it('does not offer a conflict again when the same BGG value was declined', () => {
    const entry = manual('c1', { ...same, booth: '2-B10' })
    expect(reconcileFacts([entry], fresh(listed), { 'c1:446453:booth': '3-A100' }, T3)).toEqual({ updates: [], conflicts: [] })
  })

  it('offers a declined conflict again when BGG now says something else', () => {
    const entry = manual('c1', { ...same, booth: '2-B10' })
    const { conflicts } = reconcileFacts([entry], fresh(listed), { 'c1:446453:booth': '3-A099' }, T3)
    expect(conflicts).toMatchObject([{ field: 'booth', own: '2-B10', bgg: '3-A100' }])
  })

  it('compares the price in cents and currency, shown as money', () => {
    const entry = manual('c1', { ...same, booth: '3-A100', priceCents: 3500 })
    expect(reconcileFacts([entry], fresh(listed), {}, T3).conflicts).toEqual([
      { collectionId: 'c1', bggId: 446453, field: 'price', own: '€35', bgg: '€30', bggFacts: { priceCents: 3000, currency: 'EUR' } },
    ])
    const otherCurrency = manual('c1', { ...same, booth: '3-A100', currency: 'USD' })
    expect(reconcileFacts([otherCurrency], fresh(listed), {}, T3).conflicts).toMatchObject([{ field: 'price', own: '$30', bgg: '€30' }])
  })

  it('never touches removed entries', () => {
    const removed = manual('c1', { booth: '2-B10' }, { deleted: true })
    expect(reconcileFacts([removed], fresh(listed), {}, T3)).toEqual({ updates: [], conflicts: [] })
  })

  it('offers one conflict per collection when two collections differ', () => {
    const entries = [manual('c1', { booth: '2-B10' }), manual('c2', { booth: '5-C5' })]
    expect(reconcileFacts(entries, fresh(listed), {}, T3).conflicts.map(c => [c.collectionId, c.own])).toEqual([
      ['c1', '2-B10'],
      ['c2', '5-C5'],
    ])
  })
})

describe('applying the choices of the conflicts sheet', () => {
  const T3 = '2026-10-23T09:00:00.000Z'
  const own = { ...newEntry('c1', 446453, T1), facts: { booth: '2-B10', priceCents: 3500, currency: 'EUR' }, factsSource: 'manual' as const }
  const conflicts = [
    { collectionId: 'c1', bggId: 446453, field: 'booth' as const, own: '2-B10', bgg: '3-A100', bggFacts: { booth: '3-A100' } },
    { collectionId: 'c1', bggId: 446453, field: 'price' as const, own: '€35', bgg: '€30', bggFacts: { priceCents: 3000, currency: 'EUR' } },
  ]
  const key = (field: string) => `c1:446453:${field}`

  it('writes a BGG choice, and the source becomes preview once no own value is left', () => {
    const { updates, declined } = applyConflictChoices([own], conflicts, { [key('booth')]: 'bgg', [key('price')]: 'bgg' }, T3)
    expect(updates).toEqual([{ ...own, facts: { booth: '3-A100', priceCents: 3000, currency: 'EUR' }, factsSource: 'preview', updatedAt: T3 }])
    expect(declined).toEqual({})
  })

  it('keeps the source manual while an own value is kept', () => {
    const { updates } = applyConflictChoices([own], conflicts, { [key('booth')]: 'bgg', [key('price')]: 'own' }, T3)
    expect(updates).toMatchObject([{ facts: { booth: '3-A100', priceCents: 3500 }, factsSource: 'manual' }])
  })

  it('records the BGG value of an own choice as declined and changes nothing', () => {
    const { updates, declined } = applyConflictChoices([own], conflicts, { [key('booth')]: 'own', [key('price')]: 'own' }, T3)
    expect(updates).toEqual([])
    expect(declined).toEqual({ [key('booth')]: '3-A100', [key('price')]: '€30' })
  })

  it('leaves conflicts without a choice (Later) alone and records nothing', () => {
    expect(applyConflictChoices([own], conflicts, {}, T3)).toEqual({ updates: [], declined: {} })
  })
})
