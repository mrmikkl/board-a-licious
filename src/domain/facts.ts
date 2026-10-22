import type { Entry, Facts } from './collection.ts'
import { formatMoney } from './money.ts'

/** Facts as a list delivers them: with the publisher's BGG company id. */
export type ListFacts = Facts & { publisherId?: number | null }

const plain = (f: ListFacts): Facts => ({
  booth: f.booth ?? null,
  priceCents: f.priceCents ?? null,
  currency: f.currency ?? null,
  publisher: f.publisher ?? null,
  edition: f.edition ?? null,
})

/** FR-010: an entry added from a list keeps whatever the list says about the game (booth, price, …). */
export function factsFromList(facts: ListFacts | null | undefined): Pick<Entry, 'facts' | 'factsSource'> {
  const kept = facts ? plain(facts) : null
  if (!kept || Object.values(kept).every(v => v === null || v === '')) return { facts: null, factsSource: null }
  return { facts: kept, factsSource: 'preview' }
}

const text = (value: string | null | undefined) => value?.trim() || null

/** FR-011: facts typed in by hand are marked manual; all parts empty clears them. */
export function setManualFacts(entry: Entry, facts: Facts, now: string): Entry {
  const clean: Facts = {
    booth: text(facts.booth),
    priceCents: facts.priceCents ?? null,
    currency: text(facts.currency),
    publisher: text(facts.publisher),
    edition: text(facts.edition),
  }
  const empty = clean.booth === null && clean.priceCents === null && clean.publisher === null && clean.edition === null
  return { ...entry, facts: empty ? null : clean, factsSource: empty ? null : 'manual', updatedAt: now }
}

const sameFacts = (a: Facts | null, b: Facts) =>
  a !== null && a.booth === b.booth && a.priceCents === b.priceCents && a.currency === b.currency && a.publisher === b.publisher && (a.edition ?? null) === b.edition

/**
 * Entries whose preview facts differ from a freshly loaded preview, updated (booth, price, and the
 * publisher once known). Manual facts and removed entries are never touched.
 */
export function refreshPreviewFacts(entries: Entry[], fresh: Map<number, ListFacts>, now: string): Entry[] {
  const changed: Entry[] = []
  for (const entry of entries) {
    const latest = fresh.get(entry.bggId)
    if (!latest || entry.deleted || entry.factsSource !== 'preview') continue
    const facts = { ...plain(latest), publisher: latest.publisher ?? entry.facts?.publisher ?? null }
    if (!sameFacts(entry.facts, facts)) changed.push({ ...entry, facts, updatedAt: now })
  }
  return changed
}

/** The four fields a list fills in; a price is compared as cents and currency together. */
export const FACT_FIELDS = ['booth', 'price', 'publisher', 'edition'] as const
export type FactField = (typeof FACT_FIELDS)[number]

/** A hand-typed field that differs from BGG's value, offered for a choice (US5). */
export type Conflict = {
  collectionId: string
  bggId: number
  field: FactField
  /** The own value and BGG's value as shown to the person. */
  own: string
  bgg: string
  /** The facts BGG's value is written from, for "Use BGG". */
  bggFacts: Facts
}

/** Settled conflicts: `collectionId:bggId:field` → the BGG value the person kept their own value against. */
export type Declined = Record<string, string>

export const conflictKey = (c: Pick<Conflict, 'collectionId' | 'bggId' | 'field'>) => `${c.collectionId}:${c.bggId}:${c.field}`

const shown = (facts: Facts | ListFacts, field: FactField): string | null => {
  switch (field) {
    case 'booth':
      return facts.booth?.trim() || null
    case 'price':
      return facts.priceCents == null || !facts.currency ? null : formatMoney(facts.priceCents, facts.currency)
    case 'publisher':
      return facts.publisher?.trim() || null
    case 'edition':
      return facts.edition?.trim() || null
  }
}

/** The part of a facts object one field is made of, so writing a value touches nothing else. */
function partsOf(facts: Facts, field: FactField): Facts {
  switch (field) {
    case 'booth':
      return { booth: facts.booth ?? null }
    case 'price':
      return { priceCents: facts.priceCents ?? null, currency: facts.currency ?? null }
    case 'publisher':
      return { publisher: facts.publisher ?? null }
    case 'edition':
      return { edition: facts.edition ?? null }
  }
}

const bggFacts = (latest: ListFacts): Facts => ({
  booth: latest.booth ?? null,
  priceCents: latest.priceCents ?? null,
  currency: latest.currency ?? null,
  publisher: latest.publisher ?? null,
  edition: latest.edition ?? null,
})

/**
 * Resync (US5, research R10): what a freshly loaded list changes for the given entries. Entries
 * without facts take the list's; preview facts follow the list; a hand-typed entry gets its empty
 * fields filled, and a field that differs from BGG is a conflict unless its BGG value was declined.
 * Removed entries and games the list does not mention are left alone.
 */
export function reconcileFacts(entries: Entry[], fresh: Map<number, ListFacts>, declined: Declined, now: string): { updates: Entry[]; conflicts: Conflict[] } {
  const updates: Entry[] = []
  const conflicts: Conflict[] = []
  for (const entry of entries) {
    const latest = fresh.get(entry.bggId)
    if (!latest || entry.deleted) continue
    if (entry.factsSource === null) {
      const taken = factsFromList(latest)
      if (taken.factsSource) updates.push({ ...entry, ...taken, updatedAt: now })
      continue
    }
    if (entry.factsSource === 'preview') {
      updates.push(...refreshPreviewFacts([entry], fresh, now))
      continue
    }
    let facts: Facts = { ...entry.facts }
    let filled = false
    for (const field of FACT_FIELDS) {
      const bgg = shown(latest, field)
      const own = shown(facts, field)
      if (bgg === null) continue
      if (own === null) {
        facts = { ...facts, ...partsOf(bggFacts(latest), field) }
        filled = true
      } else if (own !== bgg && declined[`${entry.collectionId}:${entry.bggId}:${field}`] !== bgg) {
        conflicts.push({ collectionId: entry.collectionId, bggId: entry.bggId, field, own, bgg, bggFacts: partsOf(bggFacts(latest), field) })
      }
    }
    if (filled) updates.push({ ...entry, facts, updatedAt: now })
  }
  return { updates, conflicts }
}

/**
 * The person's choices in the conflicts sheet (`choices`: conflict key → "bgg" or "own"). BGG's value
 * is written; a field kept as own is recorded as declined. The source becomes `preview` once every
 * hand-typed field of the entry now comes from BGG; a conflict left unchosen keeps its own value.
 */
export function applyConflictChoices(
  entries: Entry[],
  conflicts: Conflict[],
  choices: Record<string, 'bgg' | 'own'>,
  now: string,
): { updates: Entry[]; declined: Declined } {
  const declined: Declined = {}
  for (const conflict of conflicts) {
    if (choices[conflictKey(conflict)] === 'own') declined[conflictKey(conflict)] = conflict.bgg
  }
  const updates: Entry[] = []
  for (const entry of entries) {
    const mine = conflicts.filter(c => c.collectionId === entry.collectionId && c.bggId === entry.bggId)
    const fromBgg = mine.filter(c => choices[conflictKey(c)] === 'bgg')
    if (fromBgg.length === 0) continue
    const facts = fromBgg.reduce<Facts>((acc, c) => ({ ...acc, ...c.bggFacts }), { ...entry.facts })
    const chosen = new Set<FactField>(fromBgg.map(c => c.field))
    const stillOwn = FACT_FIELDS.some(field => !chosen.has(field) && shown(entry.facts ?? {}, field) !== null)
    updates.push({ ...entry, facts, factsSource: stillOwn ? 'manual' : 'preview', updatedAt: now })
  }
  return { updates, declined }
}
