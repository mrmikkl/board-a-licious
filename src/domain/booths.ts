import type { Entry } from './collection.ts'

/** One booth per part of a (merged) booth text: "7-C111 / 3-V300" → ["7-C111", "3-V300"]. */
const boothsOf = (text: string | null | undefined) =>
  (text ?? '')
    .split(/[/,;]/)
    .map(b => b.trim().toUpperCase())
    .filter(b => /^[^-\s]+-\S+/.test(b))

const hallOfBooth = (booth: string) => booth.slice(0, booth.indexOf('-'))

/** The halls of a booth text, sorted: "7-C111 / 3-V300" → ["3", "7"]; booths like "R400" have none. */
export function hallsOf(text: string | null | undefined): string[] {
  const halls = [...new Set(boothsOf(text).map(hallOfBooth))].map(h => (/^\d+$/.test(h) ? h : h.charAt(0) + h.slice(1).toLowerCase()))
  return halls.sort(compareHalls)
}

const isNumber = (hall: string) => /^\d+$/.test(hall)
const compareHalls = (a: string, b: string) =>
  isNumber(a) && isNumber(b) ? Number(a) - Number(b) : isNumber(a) ? -1 : isNumber(b) ? 1 : a.localeCompare(b)

export type HallGroup = { key: string; label: string; entries: Entry[] }

/**
 * A collection grouped by fair hall (the part of the booth before "-"): halls in order, numbered
 * ones first; inside a hall by booth, then name. A game with booths in several halls appears in
 * each; games without a booth come last ("No booth yet").
 */
export function groupByHall(entries: Entry[], nameOf: (entry: Entry) => string): HallGroup[] {
  const live = entries.filter(e => !e.deleted)
  const byHall = new Map<string, { entry: Entry; booth: string }[]>()
  const none: Entry[] = []
  for (const entry of live) {
    const booths = boothsOf(entry.facts?.booth)
    if (booths.length === 0) {
      none.push(entry)
      continue
    }
    const seen = new Set<string>()
    for (const booth of booths) {
      const hall = hallsOf(booth)[0]!
      if (seen.has(hall)) continue
      seen.add(hall)
      byHall.set(hall, [...(byHall.get(hall) ?? []), { entry, booth }])
    }
  }
  const byBooth = (a: { entry: Entry; booth: string }, b: { entry: Entry; booth: string }) =>
    a.booth.localeCompare(b.booth, 'en', { numeric: true }) || nameOf(a.entry).localeCompare(nameOf(b.entry))
  const groups: HallGroup[] = [...byHall.keys()].sort(compareHalls).map(hall => ({
    key: hall,
    label: isNumber(hall) ? `Hall ${hall}` : hall,
    entries: byHall.get(hall)!.sort(byBooth).map(x => x.entry),
  }))
  if (none.length > 0) groups.push({ key: 'none', label: 'No booth yet', entries: none.sort((a, b) => nameOf(a).localeCompare(nameOf(b))) })
  return groups
}
