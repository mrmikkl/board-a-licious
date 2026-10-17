import type { Collection, Entry } from './collection.ts'
import { MARKS, type Mark } from './marks.ts'
import { formatMoney } from './money.ts'

/** Name and year of a game, looked up by BGG id; entries carry no names. */
export type GameNames = ReadonlyMap<number, { name: string; year: number | null }>

export type ShareResult = { ok: true; text: string } | { ok: false; reason: string }

export const DEFAULT_SHARE_MARKS: Mark[] = ['must_have', 'interested']

export const gameName = (games: GameNames, bggId: number) => games.get(bggId)?.name ?? `BGG game ${bggId}`

export const bggUrl = (bggId: number) => `https://boardgamegeek.com/boardgame/${bggId}`

const activeIn = (collectionId: string, entries: Entry[]) =>
  entries.filter(e => e.collectionId === collectionId && !e.deleted)

/** Every group in mark order with its number of games, for the group checkboxes. */
export function shareGroups(collectionId: string, entries: Entry[]) {
  const own = activeIn(collectionId, entries)
  return MARKS.map(m => ({ mark: m.key, label: m.label, emoji: m.emoji, count: own.filter(e => e.mark === m.key).length }))
}

function line(entry: Entry, collection: Collection, games: GameNames): string {
  const parts = [`${entry.bought ? '✅ ' : ''}${gameName(games, entry.bggId)}`]
  if (collection.type === 'essen' && entry.facts) {
    const { booth, priceCents, currency } = entry.facts
    const facts = [booth, priceCents == null ? null : formatMoney(priceCents, currency)].filter(Boolean)
    if (facts.length > 0) parts.push(facts.join(', '))
  }
  parts.push(bggUrl(entry.bggId))
  return `• ${parts.join(' – ')}`
}

/** Plain-text message for one collection and the chosen groups (contracts/share-and-backup.md). */
export function shareText(collection: Collection, entries: Entry[], marks: Iterable<Mark>, games: GameNames): ShareResult {
  const chosen = new Set(marks)
  if (chosen.size === 0) return { ok: false, reason: 'Choose at least one group to share.' }
  const own = activeIn(collection.id, entries)
  const byName = (a: Entry, b: Entry) => gameName(games, a.bggId).localeCompare(gameName(games, b.bggId), 'en')
  const groups = MARKS.filter(m => chosen.has(m.key))
    .map(m => ({ m, games: own.filter(e => e.mark === m.key).sort(byName) }))
    .filter(g => g.games.length > 0)
  if (groups.length === 0) return { ok: false, reason: 'The chosen groups have no games.' }
  const blocks = groups.map(({ m, games: list }) =>
    [`${m.emoji} ${m.label} (${list.length})`, ...list.map(e => line(e, collection, games))].join('\n'),
  )
  return { ok: true, text: [`🎲 ${collection.name}`, ...blocks].join('\n\n') }
}
