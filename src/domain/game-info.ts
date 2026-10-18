import type { Facts } from './collection.ts'
import { formatMoney } from './money.ts'

/** What BoardGameGeek says about a game beyond its name: players, designers, mechanisms, publisher. */
export type GameDetails = {
  minPlayers: number | null
  maxPlayers: number | null
  designers: string[]
  mechanisms: string[]
  /** The game's first publisher on BGG; a list's publisher (the one at the booth) wins over it. */
  publisher: string | null
}

export type InfoKey = 'price' | 'players' | 'booth' | 'edition' | 'designer' | 'mechanisms'
export type Info = { key: InfoKey; label: string; text: string; items?: string[] }

/** A game row shows this many infos; the details show all. */
export const ROW_INFOS = 3

const clean = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() || null : null)
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [])

function players(min: number | null | undefined, max: number | null | undefined): string | null {
  const lo = min && min > 0 ? min : null
  const hi = max && max > 0 ? max : null
  if (lo && hi) return lo === hi ? `${lo} ${lo === 1 ? 'player' : 'players'}` : `${lo}–${hi} players`
  if (lo) return `${lo}+ players`
  if (hi) return `up to ${hi} players`
  return null
}

/**
 * FR-010: the infos of a game in this order, each left out when unknown: price, players, booth,
 * edition, designer, mechanisms. Price, booth and edition come from a list (or were typed in),
 * the rest from the game's BGG details.
 */
export function gameInfos(facts: Facts | null | undefined, details: Partial<GameDetails> | null | undefined): Info[] {
  const infos: Info[] = []
  const add = (key: InfoKey, label: string, text: string | null, items?: string[]) => {
    if (text) infos.push(items ? { key, label, text, items } : { key, label, text })
  }
  add('price', 'Price', facts?.priceCents != null ? formatMoney(facts.priceCents, facts.currency) : null)
  add('players', 'Players', players(details?.minPlayers, details?.maxPlayers))
  const booth = clean(facts?.booth)
  add('booth', 'Booth', booth && `Booth ${booth}`)
  add('edition', 'Edition', clean(facts?.edition))
  const designers = list(details?.designers)
  add('designer', 'Designer', designers.join(', ') || null)
  const mechanisms = list(details?.mechanisms)
  if (mechanisms.length > 0) add('mechanisms', 'Mechanisms', mechanisms.join(', '), mechanisms)
  return infos
}

/** The first three infos, for a game row. */
export const rowInfos = (facts: Facts | null | undefined, details: Partial<GameDetails> | null | undefined) => gameInfos(facts, details).slice(0, ROW_INFOS)

/** The publisher shown under the name: the list's (at the booth), else the game's first on BGG. */
export const publisherOf = (facts: Facts | null | undefined, details: Partial<GameDetails> | null | undefined) =>
  clean(facts?.publisher) ?? clean(details?.publisher)
