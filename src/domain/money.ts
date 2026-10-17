const SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£' }

/** "€52", "€12.50", "CHF 30": no cents when whole (FR-007); no currency means EUR (FR-008). */
export function formatMoney(cents: number, currency: string | null | undefined): string {
  const code = currency ?? 'EUR'
  const amount = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
  const symbol = SYMBOLS[code]
  return symbol ? `${symbol}${amount}` : `${code} ${amount}`
}
