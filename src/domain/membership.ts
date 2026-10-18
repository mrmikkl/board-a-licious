import { type Collection, type Entry, newEntry } from './collection.ts'
import { type ListFacts, factsFromList } from './facts.ts'

/** IDs of the collections a game is in (removed entries do not count). */
export function memberships(entries: Entry[], bggId: number): Set<string> {
  return new Set(entries.filter(e => e.bggId === bggId && !e.deleted).map(e => e.collectionId))
}

/**
 * FR-014: the collections ticked on Done compared with those before. New ticks become new entries
 * (facts per FR-010); unticked ones become tombstones, taking mark, bought and price with them.
 */
export function membershipChanges(input: {
  bggId: number
  before: Set<string>
  after: Set<string>
  collections: Collection[]
  entries: Entry[]
  facts?: ListFacts | null
  now: string
}): { adds: Entry[]; removals: Entry[] } {
  const { bggId, before, after, now } = input
  const adds: Entry[] = []
  const removals: Entry[] = []
  for (const collection of input.collections) {
    if (collection.deleted) continue
    const id = collection.id
    if (after.has(id) && !before.has(id)) {
      adds.push({ ...newEntry(id, bggId, now), ...factsFromList(input.facts) })
    } else if (before.has(id) && !after.has(id)) {
      const current = input.entries.find(e => e.collectionId === id && e.bggId === bggId && !e.deleted)
      if (current) removals.push({ ...current, deleted: true, updatedAt: now })
    }
  }
  return { adds, removals }
}
