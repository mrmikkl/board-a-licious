import type { Offer, OfferLanguage } from '../../src/domain/offers.ts'
import type { PriceHttp } from './http.ts'

/** The `sitename` brettspielpreise.de's API asks for: the app's address (research R1). */
export const BRETTSPIELPREISE_SITE = 'https://board-a-licious.boardgamegeek.workers.dev'
/** Its terms ask for at least an hour of caching. */
const TTL = 3600
const BASE = 'https://brettspielpreise.de'

type Price = { link: string; price: number; product: number; shipping: string | number; stock: string; shipping_known: boolean; country: string }
type Item = { name: string; url: string; versions?: { lang?: string[]; version?: string }; prices: Price[] }

const COUNTRIES: Record<string, string> = {
  DE: 'Germany', AT: 'Austria', CH: 'Switzerland', NL: 'the Netherlands', BE: 'Belgium', LU: 'Luxembourg', FR: 'France',
  GB: 'the UK', IE: 'Ireland', DK: 'Denmark', SE: 'Sweden', NO: 'Norway', FI: 'Finland', PL: 'Poland', CZ: 'Czechia',
  ES: 'Spain', PT: 'Portugal', IT: 'Italy', GR: 'Greece', HU: 'Hungary',
}
export const countryName = (code: string) => COUNTRIES[code] ?? code

/** GB (or US) → English, DE → German; an edition in both counts as German; none → unknown; others → dropped. */
function language(langs: string[] | undefined): OfferLanguage | null {
  if (!langs || langs.length === 0) return 'unknown'
  if (langs.includes('DE')) return 'de'
  if (langs.includes('GB') || langs.includes('US')) return 'en'
  return null
}

/** The site's search for a game, for the "Open on brettspielpreise.de" link. */
export const searchUrl = (name: string) => `${BASE}/item/search?search=${encodeURIComponent(name)}`

/**
 * F007 R1: new offers for English and German editions from brettspielpreise.de's public API, by BGG id.
 * The API names no shops (on purpose): an offer shows the shop's country; links go through the site.
 */
export async function getNewOffers(http: PriceHttp, bggId: number): Promise<Offer[]> {
  const url = `${BASE}/api/info?eid=${bggId}&sitename=${encodeURIComponent(BRETTSPIELPREISE_SITE)}&currency=EUR&destination=DE&locale=en&sort=CHEAP1`
  const body = await http.getJson<{ items?: Item[] }>(url, TTL)
  const offers: Offer[] = []
  for (const item of body.items ?? []) {
    const lang = language(item.versions?.lang)
    if (!lang) continue
    for (const p of item.prices ?? []) {
      const product = Number(p.product)
      const shipping = p.shipping_known ? Number(p.shipping) : null
      offers.push({
        source: 'brettspielpreise',
        kind: 'new',
        seller: `Shop in ${countryName(p.country)}`,
        country: p.country || null,
        title: item.versions?.version || item.name,
        language: lang,
        price: { amount: product, currency: 'EUR' },
        shipping,
        euroTotal: Math.round((product + (shipping ?? 0)) * 100) / 100,
        available: p.stock !== 'N',
        condition: null,
        note: null,
        auction: null,
        listedAt: null,
        link: p.link,
      })
    }
  }
  return offers
}
