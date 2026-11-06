/** F007: where to buy a game: offers from price sources (data-model.md). */

export type OfferLanguage = 'en' | 'de' | 'unknown'
export type PriceLanguage = 'both' | 'en' | 'de'

export type Offer = {
  source: 'brettspielpreise' | 'bgg' | 'unknowns'
  kind: 'new' | 'used'
  /** "Shop in Germany", "BGG marketplace", "unknowns.de" */
  seller: string
  /** the shop's country (ISO code) where the source gives it */
  country: string | null
  /** edition or listing name */
  title: string | null
  language: OfferLanguage
  /** item price; null = "price in the listing" */
  price: { amount: number; currency: string } | null
  /** in euros; null = unknown, 0 = free */
  shipping: number | null
  /** item price in euros plus shipping; the sort key */
  euroTotal: number | null
  available: boolean
  condition: string | null
  /** the start of the seller's text */
  note: string | null
  auction: { endsAt: string } | null
  listedAt: string | null
  link: string
}

export type PriceLink = { name: string; url: string }

export type PricesAnswer = {
  bggId: number
  checkedAt: string
  sources: string[]
  failed: string[]
  offers: Offer[]
  links: PriceLink[]
}

/** Research R3: a BGG marketplace listing counts as European by its currency (FR-007a). */
export const EUROPEAN_CURRENCIES = ['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF'] as const

/** An amount in euros with the ECB's reference rates (units of the currency per euro), rounded to cents. */
export function toEuro(amount: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === 'EUR') return Math.round(amount * 100) / 100
  const rate = rates[currency]
  return rate && rate > 0 ? Math.round((amount / rate) * 100) / 100 : null
}

const ENGLISH = /\b(english|englisch\w*|en)\b|\bengl\./i
const GERMAN = /\b(deutsch\w*|german|de)\b/i

/** Research R8: a marketplace listing's language from its text; both or none → unknown. */
export function listingLanguage(text: string | null | undefined): OfferLanguage {
  const value = text ?? ''
  const en = ENGLISH.test(value)
  const de = GERMAN.test(value)
  return en === de ? 'unknown' : en ? 'en' : 'de'
}

const byTotal = (a: Offer, b: Offer) => (a.euroTotal ?? Infinity) - (b.euroTotal ?? Infinity)

/**
 * The offers as the price screen shows them (FR-005, FR-006): only the chosen language; new offers of
 * unknown language only on request (used ones always, marketplaces rarely say); new offers available
 * first, then the cheapest total; used offers by total; unknown totals last.
 */
export function arrangeOffers(offers: Offer[], options: { language: PriceLanguage; showUnknown: boolean }) {
  const fits = (o: Offer) => options.language === 'both' || o.language === options.language || o.language === 'unknown'
  const allNew = offers.filter(o => o.kind === 'new' && fits(o) && (options.language === 'both' || o.language !== 'unknown' || options.showUnknown))
  const hiddenUnknown = options.showUnknown ? 0 : allNew.filter(o => o.language === 'unknown').length
  const newOffers = allNew
    .filter(o => options.showUnknown || o.language !== 'unknown')
    .sort((a, b) => Number(b.available) - Number(a.available) || byTotal(a, b))
  const usedOffers = offers.filter(o => o.kind === 'used' && fits(o)).sort(byTotal)
  return { newOffers, usedOffers, hiddenUnknown }
}
