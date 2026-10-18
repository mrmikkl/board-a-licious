import type { Entry, Facts } from './collection.ts'

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
