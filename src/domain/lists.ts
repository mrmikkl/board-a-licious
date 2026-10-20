export type ListKind = 'preview' | 'geeklist'

export type ListRef = { kind: ListKind; id: number }

/** The list most people at the fair start with; suggested in the link fields until it is on the device. */
export const SPIEL_PREVIEW_LINK = 'https://boardgamegeek.com/geekpreview/93/spiel-essen-2026'

export function suggestSpielPreview(lists: ListRef[]): boolean {
  return !lists.some(l => l.kind === 'preview' && l.id === 93)
}

const LIST_LINK = /(?:^|[\s/])(?:www\.)?boardgamegeek\.com\/(geekpreview|geeklist)\/(\d+)(?:[/?#\s]|$)/i

/** Kind and id from a pasted BGG list link (`/geekpreview/<id>…`, `/geeklist/<id>…`), else null. */
export function parseListLink(text: string): ListRef | null {
  const match = LIST_LINK.exec(text.trim())
  if (!match) return null
  const id = Number(match[2])
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return { kind: match[1]!.toLowerCase() === 'geekpreview' ? 'preview' : 'geeklist', id }
}

type MergeFacts = {
  booth?: string | null
  priceCents?: number | null
  currency?: string | null
  publisherId?: number | null
  publisher?: string | null
  edition?: string | null
}

const joinUnique = (values: (string | null | undefined)[], separator: string) => {
  const unique = [...new Set(values.map(v => v?.trim()).filter((v): v is string => Boolean(v)))]
  return unique.length > 0 ? unique.join(separator) : null
}

/**
 * One row per game. A BGG preview lists one item per edition or publisher, so a game can appear
 * several times (other booth, other publisher, sometimes on another page). The merged row keeps the
 * first position and every booth ("7-C111 / 3-V300") and publisher ("Ruse.Games, HABA") and edition; the price
 * is the first one listed.
 */
export function mergeListEntries<E extends { position: number; bggId: number; facts?: MergeFacts }>(items: E[]): E[] {
  const groups = new Map<number, E[]>()
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const group = groups.get(item.bggId)
    if (group) group.push(item)
    else groups.set(item.bggId, [item])
  }
  return [...groups.values()].map(([first, ...rest]) => {
    if (rest.length === 0 || !first!.facts) return first!
    const all = [first!, ...rest].map(e => e.facts).filter((f): f is MergeFacts => Boolean(f))
    const priced = all.find(f => f.priceCents != null)
    return {
      ...first!,
      facts: {
        ...first!.facts,
        booth: joinUnique(all.map(f => f.booth), ' / '),
        priceCents: priced?.priceCents ?? null,
        currency: priced?.currency ?? null,
        publisherId: all.find(f => f.publisherId != null)?.publisherId ?? null,
        publisher: joinUnique(all.map(f => f.publisher), ', '),
        edition: joinUnique(all.map(f => f.edition), ', '),
      },
    }
  })
}

/** A BGG list someone loaded; synced so their other devices show it too (the games load per device). */
export type LoadedList = {
  kind: ListKind
  id: number
  title: string
  updatedAt: string
  deleted: boolean
}

/** Null when valid, else the first problem. */
export function validateLoadedList(l: LoadedList): string | null {
  if (!l || typeof l !== 'object') return 'A list must be an object.'
  if (l.kind !== 'preview' && l.kind !== 'geeklist') return 'The list kind must be "preview" or "geeklist".'
  if (!Number.isSafeInteger(l.id) || l.id <= 0) return 'The list id must be a positive whole number.'
  if (typeof l.title !== 'string' || l.title.trim().length === 0 || l.title.length > 300) return 'The list needs a title of up to 300 characters.'
  if (typeof l.updatedAt !== 'string' || Number.isNaN(Date.parse(l.updatedAt))) return 'updatedAt must be a timestamp.'
  if (typeof l.deleted !== 'boolean') return 'deleted must be true or false.'
  return null
}
