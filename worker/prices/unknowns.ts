import { type Offer, listingLanguage } from '../../src/domain/offers.ts'
import { fold } from '../../src/domain/search.ts'
import { decodeText } from '../bgg/xml.ts'
import type { PriceHttp } from './http.ts'

const FEED = 'https://unknowns.de/marketplace/marketplace-feed/'
const TTL = 3600
const NOTE_LENGTH = 140

const tag = (item: string, name: string) => {
  const m = item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`))
  return m ? decodeText(m[1]) : ''
}
const PRICE = /(\d{1,4}(?:[.,]\d{1,2})?)\s?(?:€|EUR\b|Euro\b)/i

/**
 * F007 R6: unknowns.de publishes a feed of its newest 20 marketplace entries; "Biete:" entries whose title
 * names the game become used offers, with a price when the text names one.
 */
export async function getUnknownsOffers(http: PriceHttp, name: string): Promise<Offer[]> {
  const xml = await http.getText(FEED, TTL)
  const wanted = fold(name.trim())
  const offers: Offer[] = []
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(item!, 'title')
    if (!/^biete:/i.test(title) || !fold(title).includes(wanted)) continue
    const text = tag(item!, 'description').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const price = text.match(PRICE)
    const amount = price ? Number(price[1]!.replace(',', '.')) : null
    const date = new Date(tag(item!, 'pubDate'))
    offers.push({
      source: 'unknowns',
      kind: 'used',
      seller: 'unknowns.de',
      country: 'DE',
      title: title.replace(/^biete:\s*/i, ''),
      language: listingLanguage(`${title} ${text}`),
      price: amount ? { amount, currency: 'EUR' } : null,
      shipping: null,
      euroTotal: amount,
      available: true,
      condition: null,
      note: text ? text.slice(0, NOTE_LENGTH) : null,
      auction: null,
      listedAt: Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10),
      link: tag(item!, 'link'),
    })
  }
  return offers
}
