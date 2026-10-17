const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }

/** "€52", "€12.50", "CHF 30": no cents when whole (FR-007); no currency means EUR (FR-008). */
export function formatMoney(cents: number, currency: string | null | undefined): string {
  const code = currency ?? 'EUR'
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
  const symbol = SYMBOLS[code]
  return symbol ? `${symbol}${amount}` : `${code} ${amount}`
}

export const PRICE_MAX_CENTS = 999900

/** "52", "12,50", "12.50" → cents; null when it is not a price from 0 to 9,999 with up to two decimals (FR-007). */
export function parsePrice(text: string): number | null {
  const match = /^(\d{1,4})(?:[.,](\d{1,2}))?$/.exec(text.trim())
  if (!match) return null
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return cents <= PRICE_MAX_CENTS ? cents : null
}

/** A price as a prefilled input: "52", "12.50"; empty without one. */
export const priceInput = (cents: number | null | undefined) =>
  cents == null ? '' : cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)

/** Money per currency: "€152 + $40" (FR-008). */
export const formatSpent = (totals: { currency: string; cents: number }[]) =>
  totals.map(t => formatMoney(t.cents, t.currency)).join(' + ')
