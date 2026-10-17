import type { CollectionType, Entry, Facts } from './collection.ts'

/** Facts as a list delivers them: with the publisher's BGG company id. */
export type ListFacts = Facts & { publisherId?: number | null }

/**
 * FR-010: booth, price and publisher are kept only when a game comes from an Essen list (a BGG
 * preview) into an Essen collection; every other combination says why they are left out.
 */
export function factsRule(listIsEssen: boolean, collectionType: CollectionType): { keep: boolean; reason: string } {
  if (listIsEssen && collectionType === 'essen') return { keep: true, reason: 'Booth, price and publisher are kept' }
  if (listIsEssen) return { keep: false, reason: 'Added without booth and price: standard collection' }
  return { keep: false, reason: 'Added without booth and price: this list has none' }
}

const plain = (f: ListFacts): Facts => ({
  booth: f.booth ?? null,
  priceCents: f.priceCents ?? null,
  currency: f.currency ?? null,
  publisher: f.publisher ?? null,
})

/** What an entry added from a list gets: the list's facts when the rule keeps them, else none. */
export function factsFromList(
  facts: ListFacts | null | undefined,
  listIsEssen: boolean,
  collectionType: CollectionType,
): Pick<Entry, 'facts' | 'factsSource'> {
  if (!facts || !factsRule(listIsEssen, collectionType).keep) return { facts: null, factsSource: null }
  return { facts: plain(facts), factsSource: 'preview' }
}

const text = (value: string | null | undefined) => value?.trim() || null

/** FR-011: facts typed in by hand are marked manual; all parts empty clears them. */
export function setManualFacts(entry: Entry, facts: Facts, now: string): Entry {
  const clean: Facts = {
    booth: text(facts.booth),
    priceCents: facts.priceCents ?? null,
    currency: text(facts.currency),
    publisher: text(facts.publisher),
  }
  const empty = clean.booth === null && clean.priceCents === null && clean.publisher === null
  return { ...entry, facts: empty ? null : clean, factsSource: empty ? null : 'manual', updatedAt: now }
}

const sameFacts = (a: Facts | null, b: Facts) =>
  a !== null && a.booth === b.booth && a.priceCents === b.priceCents && a.currency === b.currency && a.publisher === b.publisher

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
