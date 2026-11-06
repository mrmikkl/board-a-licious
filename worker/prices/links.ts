import type { PriceLink } from '../../src/domain/offers.ts'

/**
 * F007 R4–R6 (ADR 0008): sites the app may not read open their own search for the game: Kleinanzeigen
 * (its terms forbid automated access), eBay.de (until the owner has API keys), unknowns.de's marketplace
 * search (the feed only covers the newest entries).
 */
export function priceLinks(name: string): PriceLink[] {
  const slug = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, '-'))
  return [
    { name: 'Kleinanzeigen', url: `https://www.kleinanzeigen.de/s-${slug}/k0` },
    // category 180349: Gesellschaftsspiele; condition 3000: used
    { name: 'eBay.de', url: `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(name.trim())}&_sacat=180349&LH_ItemCondition=3000` },
    // the forum's search, limited to marketplace entries, newest first
    { name: 'unknowns.de', url: `https://unknowns.de/search/?q=${encodeURIComponent(name.trim())}&type=com.viecode.marketplace.entry&sortField=time&sortOrder=DESC` },
  ]
}
