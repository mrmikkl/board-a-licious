import { type Mark, isMark } from './marks.ts'

export type CollectionType = 'essen' | 'standard'

export type Collection = {
  id: string
  name: string
  type: CollectionType
  updatedAt: string
  deleted: boolean
}

/** Booth, price and publisher of a game at the fair; every part optional. */
export type Facts = {
  booth?: string | null
  priceCents?: number | null
  currency?: string | null
  publisher?: string | null
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

export function newCollection(input: { id: string; name: string; type: CollectionType; now: string }): Collection {
  const error = checkName(input.name)
  if (error) throw new Error(error)
  return { id: input.id, name: input.name.trim(), type: input.type, updatedAt: input.now, deleted: false }
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
  if (c.type !== 'essen' && c.type !== 'standard') return 'The type must be "essen" or "standard".'
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
    if (!isOptionalText(e.facts.booth) || !isOptionalText(e.facts.publisher)) return 'Booth and publisher must be text.'
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
