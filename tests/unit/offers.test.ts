import { describe, expect, it } from 'vitest'

import { EUROPEAN_CURRENCIES, type Offer, arrangeOffers, listingLanguage, toEuro } from '../../src/domain/offers.ts'

const offer = (o: Partial<Offer>): Offer => ({
  source: 'brettspielpreise',
  kind: 'new',
  seller: 'Shop in Germany',
  country: 'DE',
  title: 'Cascadia',
  language: 'de',
  price: { amount: 30, currency: 'EUR' },
  shipping: 0,
  euroTotal: 30,
  available: true,
  condition: null,
  note: null,
  auction: null,
  listedAt: null,
  link: 'https://example.com',
  ...o,
})

describe('arrangeOffers (F007 data-model "Arranged offers")', () => {
  const offers = [
    offer({ link: 'de-35', euroTotal: 35 }),
    offer({ link: 'en-30', language: 'en', euroTotal: 30 }),
    offer({ link: 'de-out-20', euroTotal: 20, available: false }),
    offer({ link: 'de-null', euroTotal: null, shipping: null }),
    offer({ link: 'unknown-25', language: 'unknown', euroTotal: 25 }),
    offer({ link: 'used-22', kind: 'used', source: 'bgg', language: 'unknown', euroTotal: 22 }),
    offer({ link: 'used-18', kind: 'used', source: 'bgg', language: 'en', euroTotal: 18 }),
    offer({ link: 'used-none', kind: 'used', source: 'unknowns', language: 'de', price: null, euroTotal: null }),
  ]
  const links = (list: Offer[]) => list.map(o => o.link)

  it('orders new offers: available first, then the cheapest total, unknown totals last', () => {
    const { newOffers, hiddenUnknown } = arrangeOffers(offers, { language: 'both', showUnknown: false })
    expect(links(newOffers)).toEqual(['en-30', 'de-35', 'de-null', 'de-out-20'])
    expect(hiddenUnknown).toBe(1)
  })

  it('shows new offers of unknown language only on request', () => {
    const { newOffers, hiddenUnknown } = arrangeOffers(offers, { language: 'both', showUnknown: true })
    expect(links(newOffers)).toEqual(['unknown-25', 'en-30', 'de-35', 'de-null', 'de-out-20'])
    expect(hiddenUnknown).toBe(0)
  })

  it('orders used offers by total, those without a price last, and keeps an unstated language', () => {
    expect(links(arrangeOffers(offers, { language: 'both', showUnknown: false }).usedOffers)).toEqual(['used-18', 'used-22', 'used-none'])
  })

  it('narrows to one language; used offers with an unstated language stay', () => {
    const de = arrangeOffers(offers, { language: 'de', showUnknown: false })
    expect(links(de.newOffers)).toEqual(['de-35', 'de-null', 'de-out-20'])
    expect(links(de.usedOffers)).toEqual(['used-22', 'used-none'])
    expect(links(arrangeOffers(offers, { language: 'en', showUnknown: false }).newOffers)).toEqual(['en-30'])
  })
})

describe('listingLanguage (research R8)', () => {
  it.each([
    ['Cascadia board game (English), unplayed', 'en'],
    ['englische Ausgabe, 1x gespielt', 'en'],
    ['Cascadia EN, sleeved', 'en'],
    ['Cascadia (engl.) komplett', 'en'],
    ['Cascadia deutsch, Kosmos', 'de'],
    ['German edition, like new', 'de'],
    ['Cascadia DE komplett', 'de'],
    ['deutsche Ausgabe', 'de'],
    ['Played twice, cards sleeved', 'unknown'],
    ['English and German rules included', 'unknown'],
    ['Endless Winter – mint', 'unknown'],
    ['', 'unknown'],
  ])('%s → %s', (text, language) => {
    expect(listingLanguage(text)).toBe(language)
  })
})

describe('toEuro (research R3)', () => {
  const rates = { USD: 1.08, GBP: 0.85, SEK: 11.5 }
  it('converts European currencies with the ECB rate (units per euro), rounded to cents', () => {
    expect(toEuro(25, 'GBP', rates)).toBe(29.41)
    expect(toEuro(25, 'EUR', rates)).toBe(25)
    expect(toEuro(115, 'SEK', rates)).toBe(10)
  })

  it('has no value without a rate', () => {
    expect(toEuro(25, 'CHF', rates)).toBeNull()
  })

  it('lists the European currencies', () => {
    expect(EUROPEAN_CURRENCIES).toEqual(['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'])
  })
})
