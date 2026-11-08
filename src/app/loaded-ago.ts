const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** F008: how old a BGG collection on the device is, as its source line says it ("loaded 12 min ago"). */
export function loadedAgo(loadedAt: string | null | undefined, now: number): string {
  const at = loadedAt ? Date.parse(loadedAt) : Number.NaN
  if (Number.isNaN(at)) return 'not loaded yet'
  const age = Math.max(0, now - at)
  if (age < MIN) return 'loaded just now'
  if (age < HOUR) return `loaded ${Math.floor(age / MIN)} min ago`
  if (age < DAY) return `loaded ${Math.floor(age / HOUR)} h ago`
  const days = Math.floor(age / DAY)
  return `loaded ${days} ${days === 1 ? 'day' : 'days'} ago`
}
