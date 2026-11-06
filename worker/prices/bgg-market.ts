import { EUROPEAN_CURRENCIES, type Offer, listingLanguage, toEuro } from '../../src/domain/offers.ts'
import { type BggClient, TTL } from '../bgg/cache.ts'
import { asArray, decodeText, parseXml } from '../bgg/xml.ts'

type Listing = { listdate?: { value?: string }; price?: { currency?: string; value?: string }; condition?: { value?: string }; notes?: { value?: string }; link?: { href?: string } | { href?: string }[] }

const CONDITIONS: Record<string, string> = { new: 'new', likenew: 'like new', verygood: 'very good', good: 'good', acceptable: 'acceptable' }
const NOTE_LENGTH = 140
const EUROPEAN = new Set<string>(EUROPEAN_CURRENCIES)

/** F007 R3: a game's BGG marketplace listings from Europe (by currency), through the official API. */
export async function getMarketOffers(client: BggClient, bggId: number, rates: Record<string, number>): Promise<Offer[]> {
  const doc = parseXml(await client.getXml(`https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&marketplace=1`, TTL.list)) as {
    items?: { item?: { marketplacelistings?: { listing?: Listing | Listing[] } }[] }
  }
  const listings = asArray(doc.items?.item?.[0]?.marketplacelistings?.listing)
  const offers: Offer[] = []
  for (const l of listings) {
    const currency = l.price?.currency ?? ''
    const amount = Number(l.price?.value)
    // `link` is one of the XML reader's repeated tags: a list
    const link = asArray(l.link)[0]?.href
    if (!EUROPEAN.has(currency) || !(amount > 0) || !link) continue
    const note = decodeText(l.notes?.value)
    const date = new Date(l.listdate?.value ?? '')
    offers.push({
      source: 'bgg',
      kind: 'used',
      seller: 'BGG marketplace',
      country: null,
      title: null,
      language: listingLanguage(note),
      price: { amount, currency },
      shipping: null,
      euroTotal: toEuro(amount, currency, rates),
      available: true,
      condition: CONDITIONS[l.condition?.value ?? ''] ?? null,
      note: note ? note.slice(0, NOTE_LENGTH) : null,
      auction: null,
      listedAt: Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10),
      link,
    })
  }
  return offers
}
