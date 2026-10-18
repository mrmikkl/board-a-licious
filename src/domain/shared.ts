import { parseGameLink } from './bgg-link.ts'
import { type ListRef, parseListLink } from './lists.ts'

/** What the phone hands to the app when something is shared to it (F002, Web Share Target). */
export type SharedItem = { title?: string | null; text?: string | null; url?: string | null }

export type SharedResult =
  | { kind: 'game'; bggId: number; suggestedName: string }
  | { kind: 'list'; ref: ListRef }
  | { kind: 'none'; shown: string }

const LINK = /https?:\/\/[^\s<>"]+|(?:www\.)?boardgamegeek\.com\/[^\s<>"]*/gi
const BGG = /boardgamegeek\.com/i
const HAS_LINK = /https?:\/\/|boardgamegeek\.com\//i
const SHOWN_MAX = 200
/** Plain text before a link counts as a name only when it is short (a title, not a sentence). */
const NAME_MAX = 60

const links = (text: string) => [...text.matchAll(LINK)].map(m => m[0].replace(/[).,;:!?]+$/, ''))

/** "Cascadia | Board Game | BoardGameGeek" → "Cascadia"; "Ark Nova - BoardGameGeek" → "Ark Nova". */
function nameFromTitle(title: string): string | null {
  const name = title
    .split(' | ')[0]!
    .replace(/\s+[-–|]\s+BoardGameGeek\s*$/i, '')
    .trim()
  return name && !BGG.test(name) && !HAS_LINK.test(name) ? name : null
}

/** "Heat: Pedal to the Metal – https://…" → "Heat: Pedal to the Metal"; long sentences do not count. */
function nameBefore(text: string, link: string): string | null {
  const before = text
    .slice(0, text.indexOf(link))
    .replace(/[\s:–—|-]+$/, '')
    .trim()
  return before && before.length <= NAME_MAX && !HAS_LINK.test(before) ? before : null
}

/**
 * F002 (research R4): the first BoardGameGeek link in url, text, title (in this order) decides:
 * a game or expansion, a preview or geeklist, or nothing to add. The suggested name of a game is
 * the page title without BGG's suffixes, else short text before the link, else the link's slug,
 * else "Game <id>".
 */
export function readShare(item: SharedItem): SharedResult {
  const fields = [item.url, item.text, item.title].map(f => f?.trim() ?? '')
  for (const field of fields) {
    for (const link of links(field).filter(l => BGG.test(l))) {
      const game = parseGameLink(link)
      if (game.ok) {
        const suggestedName =
          (item.title?.trim() && nameFromTitle(item.title.trim())) ||
          nameBefore(field, link) ||
          game.suggestedName ||
          `Game ${game.bggId}`
        return { kind: 'game', bggId: game.bggId, suggestedName }
      }
      const list = parseListLink(link)
      if (list) return { kind: 'list', ref: list }
    }
  }
  const firstLink = fields.flatMap(links)[0]
  const shown = firstLink ?? fields[1] ?? ''
  return { kind: 'none', shown: (shown || fields[2] || '').slice(0, SHOWN_MAX) }
}
