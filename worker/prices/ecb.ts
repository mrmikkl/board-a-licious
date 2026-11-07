import type { PriceHttp } from './http.ts'

const URL_ = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const TTL = 12 * 3600

/** F007 R3: the ECB's daily reference rates, units of each currency per euro. */
export async function getRates(http: PriceHttp): Promise<Record<string, number>> {
  const xml = await http.getText(URL_, TTL)
  const rates: Record<string, number> = {}
  for (const m of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[m[1]!] = Number(m[2])
  return rates
}
