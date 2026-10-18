import { describe, expect, it } from 'vitest'

import { type Entry, boughtLine, markBought, newEntry, spentByCurrency, suggestPaid, unmarkBought, validateEntry } from '../../src/domain/collection.ts'
import { formatSpent } from '../../src/domain/money.ts'

const T1 = '2026-10-17T09:00:00.000Z'
const T2 = '2026-10-17T10:00:00.000Z'
const entry = (patch: Partial<Entry> = {}): Entry => ({ ...newEntry('c1', 295947, T1), mark: 'must_have', ...patch })

describe('bought (FR-007)', () => {
  it('suggests the listed price and its currency', () => {
    expect(suggestPaid(entry({ facts: { priceCents: 5200, currency: 'EUR' } }))).toEqual({ cents: 5200, currency: 'EUR' })
    expect(suggestPaid(entry({ facts: { priceCents: 4000, currency: 'USD' } }))).toEqual({ cents: 4000, currency: 'USD' })
  })

  it('suggests no price without a listed one, and EUR without a currency', () => {
    expect(suggestPaid(entry())).toEqual({ cents: null, currency: 'EUR' })
    expect(suggestPaid(entry({ facts: { priceCents: 1250 } }))).toEqual({ cents: 1250, currency: 'EUR' })
    expect(suggestPaid(entry({ facts: { booth: '3-A101' } }))).toEqual({ cents: null, currency: 'EUR' })
  })

  it('marks bought with the price paid, keeping the mark', () => {
    const bought = markBought(entry(), { cents: 5200, currency: 'EUR' }, T2)
    expect(bought).toMatchObject({ bought: true, paidCents: 5200, paidCurrency: 'EUR', mark: 'must_have', updatedAt: T2 })
    expect(validateEntry(bought)).toBeNull()
  })

  it('can skip the price', () => {
    const bought = markBought(entry(), null, T2)
    expect(bought).toMatchObject({ bought: true, paidCents: null, paidCurrency: null })
    expect(validateEntry(bought)).toBeNull()
  })

  it('undoing clears the price paid and its currency', () => {
    const undone = unmarkBought(markBought(entry(), { cents: 5200, currency: 'EUR' }, T1), T2)
    expect(undone).toMatchObject({ bought: false, paidCents: null, paidCurrency: null, mark: 'must_have', updatedAt: T2 })
  })
})

describe('money spent (FR-008)', () => {
  const entries = [
    markBought(entry({ bggId: 1 }), { cents: 10000, currency: 'EUR' }, T2),
    markBought(entry({ bggId: 2 }), { cents: 5200, currency: 'EUR' }, T2),
    markBought(entry({ bggId: 3 }), { cents: 4000, currency: 'USD' }, T2),
    markBought(entry({ bggId: 4 }), null, T2),
    entry({ bggId: 5, paidCents: 999, paidCurrency: 'EUR' }),
    { ...markBought(entry({ bggId: 6 }), { cents: 700, currency: 'EUR' }, T2), deleted: true },
  ]

  it('sums the price paid of bought games per currency', () => {
    expect(spentByCurrency(entries)).toEqual([
      { currency: 'EUR', cents: 15200 },
      { currency: 'USD', cents: 4000 },
    ])
    expect(formatSpent(spentByCurrency(entries))).toBe('€152 + $40')
  })

  it('says how many games are bought and what was spent', () => {
    expect(boughtLine(entries)).toBe('✅ 4 games bought, €152 + $40 spent')
    expect(boughtLine([markBought(entry(), { cents: 5200, currency: 'EUR' }, T2)])).toBe('✅ 1 game bought, €52 spent')
    expect(boughtLine([markBought(entry(), null, T2)])).toBe('✅ 1 game bought')
    expect(boughtLine([entry()])).toBeNull()
  })
})
