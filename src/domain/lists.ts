export type ListKind = 'preview' | 'geeklist'

export type ListRef = { kind: ListKind; id: number }

const LIST_LINK = /(?:^|[\s/])(?:www\.)?boardgamegeek\.com\/(geekpreview|geeklist)\/(\d+)(?:[/?#\s]|$)/i

/** Kind and id from a pasted BGG list link (`/geekpreview/<id>…`, `/geeklist/<id>…`), else null. */
export function parseListLink(text: string): ListRef | null {
  const match = LIST_LINK.exec(text.trim())
  if (!match) return null
  const id = Number(match[2])
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return { kind: match[1]!.toLowerCase() === 'geekpreview' ? 'preview' : 'geeklist', id }
}
