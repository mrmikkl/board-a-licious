/** Lower case without accents: "Café" → "cafe". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** F005 FR-018: a game's name contains the query, ignoring case and accents; a blank query matches all. */
export function matchesName(name: string, query: string): boolean {
  const q = fold(query.trim())
  return q === '' || fold(name).includes(q)
}
