import { MARKS, type Mark, type MarkInfo, isMark, markInfo } from './marks.ts'
import { formatSpent } from './money.ts'

export type Collection = {
  id: string
  name: string
  updatedAt: string
  deleted: boolean
}

/** Booth, price, publisher and edition of a game, from a list or typed in; every part optional. */
export type Facts = {
  booth?: string | null
  priceCents?: number | null
  currency?: string | null
  publisher?: string | null
  /** The edition a list offers, e.g. "English edition". */
  edition?: string | null
}

export type Entry = {
  collectionId: string
  bggId: number
  mark: Mark
  bought: boolean
  paidCents: number | null
  paidCurrency: string | null
  facts: Facts | null
  factsSource: 'preview' | 'manual' | null
  detailsPending: boolean
  updatedAt: string
  deleted: boolean
}

export const NAME_MAX = 60

/** Trimmed name, or an error message when it is empty or longer than 60 characters. */
function checkName(name: unknown): string | null {
  if (typeof name !== 'string' || name.trim().length === 0) return 'The name must not be empty.'
  if (name.trim().length > NAME_MAX) return `The name can have at most ${NAME_MAX} characters.`
  return null
}

export function newCollection(input: { id: string; name: string; now: string }): Collection {
  const error = checkName(input.name)
  if (error) throw new Error(error)
  return { id: input.id, name: input.name.trim(), updatedAt: input.now, deleted: false }
}

export function renameCollection(collection: Collection, name: string, now: string): Collection {
  const error = checkName(name)
  if (error) throw new Error(error)
  return { ...collection, name: name.trim(), updatedAt: now }
}

/** Deleting tombstones the collection and every entry in it (FR-001a). */
export function deleteCollection(collection: Collection, entries: Entry[], now: string) {
  return {
    collection: { ...collection, deleted: true, updatedAt: now },
    entries: entries
      .filter(e => e.collectionId === collection.id)
      .map(e => ({ ...e, deleted: true, updatedAt: now })),
  }
}

export function newEntry(collectionId: string, bggId: number, now: string): Entry {
  return {
    collectionId,
    bggId,
    mark: 'new',
    bought: false,
    paidCents: null,
    paidCurrency: null,
    facts: null,
    factsSource: null,
    detailsPending: false,
    updatedAt: now,
    deleted: false,
  }
}

export const markEntry = (entry: Entry, mark: Mark, now: string): Entry => ({ ...entry, mark, updatedAt: now })

/** Removing a game from a collection tombstones its entry, so other devices drop it too. */
export const removeEntry = (entry: Entry, now: string): Entry => ({ ...entry, deleted: true, updatedAt: now })

export type Paid = { cents: number; currency: string }

/** FR-007/008: the price paid is suggested from the listed price, in its currency; EUR without one. */
export function suggestPaid(entry: Entry): { cents: number | null; currency: string } {
  return { cents: entry.facts?.priceCents ?? null, currency: entry.facts?.currency ?? 'EUR' }
}

/** Bought is independent of the mark; without a price paid nothing counts towards the money spent. */
export const markBought = (entry: Entry, paid: Paid | null, now: string): Entry => ({
  ...entry,
  bought: true,
  paidCents: paid?.cents ?? null,
  paidCurrency: paid ? paid.currency : null,
  updatedAt: now,
})

/** Undoing bought also removes the price paid. */
export const unmarkBought = (entry: Entry, now: string): Entry => ({ ...entry, bought: false, paidCents: null, paidCurrency: null, updatedAt: now })

/** Money spent per currency: the prices paid of live bought games, by currency code (FR-008). */
export function spentByCurrency(entries: Entry[]): { currency: string; cents: number }[] {
  const totals = new Map<string, number>()
  for (const e of entries) {
    if (e.deleted || !e.bought || e.paidCents == null) continue
    const currency = e.paidCurrency ?? 'EUR'
    totals.set(currency, (totals.get(currency) ?? 0) + e.paidCents)
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, cents]) => ({ currency, cents }))
}

/** "✅ 1 game bought, €52 spent" under a collection's filter; null while nothing is bought. */
export function boughtLine(entries: Entry[]): string | null {
  const count = entries.filter(e => !e.deleted && e.bought).length
  if (count === 0) return null
  const spent = spentByCurrency(entries)
  return `✅ ${count} ${count === 1 ? 'game' : 'games'} bought${spent.length > 0 ? `, ${formatSpent(spent)} spent` : ''}`
}

export type CollectionGroup = { mark: MarkInfo; part: 'marked' | 'rest'; entries: Entry[] }

/** The collection view's order (R5): marked games first, then Not yet marked and Not interested. */
const GROUP_ORDER: Mark[] = ['must_have', 'interested', 'unsure', 'poop', 'new', 'skip']

/** Live entries grouped by mark in collection order (FR-005), empty groups left out, games sorted by name. */
export function groupByMark(entries: Entry[], nameOf: (entry: Entry) => string): CollectionGroup[] {
  const live = entries.filter(e => !e.deleted)
  return GROUP_ORDER.map(key => ({
    mark: markInfo(key),
    part: key === 'new' || key === 'skip' ? ('rest' as const) : ('marked' as const),
    entries: live.filter(e => e.mark === key).sort((a, b) => nameOf(a).localeCompare(nameOf(b))),
  })).filter(group => group.entries.length > 0)
}

/**
 * F004 FR-010: the games Show-off shows: live entries whose mark is in `groups`, in the collection
 * group order (must_have, interested, unsure, poop, new, skip), by name within a mark.
 */
export function showOffGames(entries: Entry[], groups: readonly Mark[], nameOf: (entry: Entry) => string): Entry[] {
  const chosen = new Set(groups)
  return groupByMark(entries, nameOf)
    .filter(group => chosen.has(group.mark.key))
    .flatMap(group => group.entries)
}

/** Games per mark and bought, for the collection card (FR-002). */
export function countMarks(entries: Entry[]) {
  const live = entries.filter(e => !e.deleted)
  const byMark = Object.fromEntries(MARKS.map(m => [m.key, 0])) as Record<Mark, number>
  for (const e of live) byMark[e.mark] += 1
  return { total: live.length, bought: live.filter(e => e.bought).length, byMark }
}

const isTimestamp = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const isCents = (value: unknown) => value === null || value === undefined || (Number.isInteger(value) && (value as number) >= 0)
const isCurrency = (value: unknown) => typeof value === 'string' && /^[A-Z]{3}$/.test(value)
const isOptionalText = (value: unknown) => value === null || value === undefined || typeof value === 'string'

/** Null when the collection is valid, else the first problem. */
export function validateCollection(c: Collection): string | null {
  if (!c || typeof c !== 'object') return 'A collection must be an object.'
  if (typeof c.id !== 'string' || c.id.length === 0 || c.id.length > 64) return 'A collection needs an id.'
  const nameError = checkName(c.name)
  if (nameError) return nameError
  if (!isTimestamp(c.updatedAt)) return 'updatedAt must be a timestamp.'
  if (typeof c.deleted !== 'boolean') return 'deleted must be true or false.'
  return null
}

/** Null when the entry is valid, else the first problem. */
export function validateEntry(e: Entry): string | null {
  if (!e || typeof e !== 'object') return 'An entry must be an object.'
  if (typeof e.collectionId !== 'string' || e.collectionId.length === 0) return 'An entry needs a collectionId.'
  if (!Number.isInteger(e.bggId) || e.bggId <= 0) return 'bggId must be a positive whole number.'
  if (!isMark(e.mark)) return `Unknown mark "${String(e.mark)}".`
  if (typeof e.bought !== 'boolean') return 'bought must be true or false.'
  if (!isCents(e.paidCents)) return 'The price paid must be a whole number of cents, 0 or more.'
  if (e.paidCents === null || e.paidCents === undefined) {
    if (e.paidCurrency !== null && e.paidCurrency !== undefined) return 'A currency needs a price paid.'
  } else if (!isCurrency(e.paidCurrency)) return 'The currency of the price paid must be a 3-letter code.'
  if (e.facts !== null && e.facts !== undefined) {
    if (typeof e.facts !== 'object') return 'facts must be an object.'
    if (!isCents(e.facts.priceCents)) return 'The listed price must be a whole number of cents, 0 or more.'
    if (e.facts.currency !== null && e.facts.currency !== undefined && !isCurrency(e.facts.currency))
      return 'The currency of the listed price must be a 3-letter code.'
    if (!isOptionalText(e.facts.booth) || !isOptionalText(e.facts.publisher) || !isOptionalText(e.facts.edition))
      return 'Booth, publisher and edition must be text.'
  }
  if (![null, 'preview', 'manual'].includes(e.factsSource)) return 'factsSource must be "preview", "manual" or null.'
  if (typeof e.detailsPending !== 'boolean') return 'detailsPending must be true or false.'
  if (!isTimestamp(e.updatedAt)) return 'updatedAt must be a timestamp.'
  if (typeof e.deleted !== 'boolean') return 'deleted must be true or false.'
  return null
}

/** Last write wins: the later updatedAt is kept; on equal timestamps the server copy wins. */
export function merge<T extends { updatedAt: string }>(local: T | undefined, server: T): T {
  if (!local) return server
  return Date.parse(local.updatedAt) > Date.parse(server.updatedAt) ? local : server
}

export const entryKey = (e: Pick<Entry, 'collectionId' | 'bggId'>) => `${e.collectionId}:${e.bggId}`
