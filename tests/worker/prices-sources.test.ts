import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createBggClient, memoryCache } from '../../worker/bgg/cache.ts'
import { getMarketOffers } from '../../worker/prices/bgg-market.ts'
import { BRETTSPIELPREISE_SITE, getNewOffers, searchUrl } from '../../worker/prices/brettspielpreise.ts'
import { getRates } from '../../worker/prices/ecb.ts'
import { createPriceHttp } from '../../worker/prices/http.ts'
import { priceLinks } from '../../worker/prices/links.ts'
import { getUnknownsOffers } from '../../worker/prices/unknowns.ts'

const fixture = (name: string) => readFileSync(new URL(`../fixtures/prices/${name}`, import.meta.url), 'utf8')

function http(answer: (url: URL) => string) {
  const calls: URL[] = []
  let t = 0
  return {
    calls,
    http: createPriceHttp({
      fetch: async input => {
        const url = new URL(String(input))
        calls.push(url)
        return new Response(answer(url))
      },
      cache: memoryCache(() => t),
      now: () => t,
      sleep: async ms => void (t += ms),
    }),
  }
}

describe('brettspielpreise.de (research R1)', () => {
  it('asks by BGG id with the app as sitename, euros and shipping to Germany', async () => {
    const { http: h, calls } = http(() => fixture('brettspielpreise-295947.json'))
    await getNewOffers(h, 295947)
    const q = calls[0]!.searchParams
    expect(calls[0]!.origin + calls[0]!.pathname).toBe('https://brettspielpreise.de/api/info')
    expect([q.get('eid'), q.get('sitename'), q.get('currency'), q.get('destination')]).toEqual(['295947', BRETTSPIELPREISE_SITE, 'EUR', 'DE'])
  })

  it('keeps English (GB) and German (DE) editions, drops others, marks editions without a language unknown', async () => {
    const { http: h } = http(() => fixture('brettspielpreise-295947.json'))
    const offers = await getNewOffers(h, 295947)
    expect(new Set(offers.map(o => o.language))).toEqual(new Set(['en', 'de', 'unknown']))
    expect(offers.filter(o => o.language === 'unknown')).toHaveLength(1)
    expect(offers.every(o => o.kind === 'new' && o.source === 'brettspielpreise')).toBe(true)
  })

  it('maps an offer: shop country, item price, shipping, total, stock, the site link', async () => {
    const { http: h } = http(() => fixture('brettspielpreise-295947.json'))
    const offers = await getNewOffers(h, 295947)
    const de = offers.filter(o => o.language === 'de')
    expect(de[0]).toMatchObject({ seller: 'Shop in Germany', country: 'DE', price: { amount: 29.99, currency: 'EUR' }, shipping: 4.9, euroTotal: 34.89, available: false })
    expect(de[1]).toMatchObject({ price: { amount: 33, currency: 'EUR' }, shipping: 2.5, euroTotal: 35.5, available: true })
    expect(de[0]!.link).toMatch(/^https:\/\/brettspielpreise\.de\/item\/go\?/)
    const unknownShipping = offers.find(o => o.shipping === null)!
    expect(unknownShipping.euroTotal).toBe(unknownShipping.price!.amount)
  })

  it('links its search page', () => {
    expect(searchUrl('Cascadia Junior')).toBe('https://brettspielpreise.de/item/search?search=Cascadia%20Junior')
  })
})

describe('ECB reference rates (research R3)', () => {
  it('reads units per euro', async () => {
    const { http: h } = http(() => fixture('ecb-daily.xml'))
    const rates = await getRates(h)
    expect(rates.GBP).toBeGreaterThan(0.5)
    expect(rates.USD).toBeGreaterThan(0.5)
    expect(Object.keys(rates)).toContain('SEK')
  })
})

describe('BGG marketplace (research R3)', () => {
  const client = () => {
    let t = 0
    return createBggClient({
      fetch: async () => new Response(fixture('bgg-market-295947.xml')),
      cache: memoryCache(() => t),
      now: () => t,
      sleep: async ms => void (t += ms),
      token: 'test-token',
      log: () => {},
    })
  }
  const rates = { GBP: 0.85, USD: 1.08, SEK: 11.5, CHF: 0.94 }

  it('keeps listings in European currencies only, as used offers with condition, note, date and link', async () => {
    const offers = await getMarketOffers(client(), 295947, rates)
    expect(offers.length).toBeGreaterThan(0)
    expect(offers.every(o => ['EUR', 'GBP'].includes(o.price!.currency))).toBe(true)
    expect(offers.every(o => o.kind === 'used' && o.seller === 'BGG marketplace' && o.link.startsWith('https://boardgamegeek.com/market/'))).toBe(true)
    expect(offers.every(o => o.shipping === null && /^\d{4}-\d{2}-\d{2}$/.test(o.listedAt!))).toBe(true)
    expect(offers.every(o => !o.condition || ['new', 'like new', 'very good', 'good', 'acceptable'].includes(o.condition))).toBe(true)
    expect(offers.every(o => (o.note ?? '').length <= 140)).toBe(true)
  })

  it('gives non-euro listings an approximate euro total', async () => {
    const gbp = (await getMarketOffers(client(), 295947, rates)).find(o => o.price!.currency === 'GBP')!
    expect(gbp.euroTotal).toBe(Math.round((gbp.price!.amount / 0.85) * 100) / 100)
  })
})

describe('unknowns.de feed (research R6)', () => {
  it('shows "Biete:" entries whose title names the game, with the price found in the text', async () => {
    const { http: h } = http(() => fixture('unknowns-feed.xml'))
    const offers = await getUnknownsOffers(h, 'Cascadia')
    expect(offers).toHaveLength(1)
    expect(offers[0]).toMatchObject({
      source: 'unknowns',
      kind: 'used',
      seller: 'unknowns.de',
      title: 'Cascadia (deutsch) – 1x gespielt',
      language: 'de',
      price: { amount: 25, currency: 'EUR' },
      euroTotal: 25,
      listedAt: '2026-11-06',
      link: 'https://unknowns.de/marketplace/entry/99999-cascadia-deutsch/',
    })
  })

  it('ignores case and accents and finds nothing for other games', async () => {
    const { http: h } = http(() => fixture('unknowns-feed.xml'))
    expect(await getUnknownsOffers(h, 'CASCÁDIA')).toHaveLength(1)
    expect(await getUnknownsOffers(h, 'Harmonies')).toEqual([])
  })
})

describe('search links (research R4–R6)', () => {
  it('opens the sites\' own searches for the game', () => {
    expect(priceLinks('Sky Team')).toEqual([
      { name: 'Kleinanzeigen', url: 'https://www.kleinanzeigen.de/s-sky-team/k0' },
      { name: 'eBay.de', url: 'https://www.ebay.de/sch/i.html?_nkw=Sky%20Team&_sacat=180349&LH_ItemCondition=3000' },
      { name: 'unknowns.de', url: 'https://unknowns.de/marketplace/' },
    ])
  })
})
