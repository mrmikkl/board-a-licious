import type { Entry } from './collection.ts'

/** One place a booth text names: a booth ("7-C111") or only its hall, when the text gives just a number ("3", "Hall 3"). */
type Place = { hall: string; booth: string | null }

const hallName = (hall: string) => (/^\d+$/.test(hall) ? hall : hall.charAt(0) + hall.slice(1).toLowerCase())

/** The places of a (merged) booth text: "7-C111 / 3" → hall 7 at C111 and hall 3 alone; "R400" and "Hall foyer" name none. */
function placesOf(text: string | null | undefined): Place[] {
  return (text ?? '')
    .split(/[/,;]/)
    .map(part => part.trim().toUpperCase())
    .flatMap((part): Place[] => {
      const hall = /^(HALL\s*)?(\d+)$/.exec(part)
      if (hall) return [{ hall: hall[2]!, booth: null }]
      return /^[^-\s]+-\S+/.test(part) ? [{ hall: hallName(part.slice(0, part.indexOf('-'))), booth: part }] : []
    })
}

const isNumber = (hall: string) => /^\d+$/.test(hall)
const compareHalls = (a: string, b: string) =>
  isNumber(a) && isNumber(b) ? Number(a) - Number(b) : isNumber(a) ? -1 : isNumber(b) ? 1 : a.localeCompare(b)

/** The halls of a booth text, sorted: "7-C111 / 3-V300" → ["3", "7"]; booths like "R400" have none. */
export function hallsOf(text: string | null | undefined): string[] {
  return [...new Set(placesOf(text).map(p => p.hall))].sort(compareHalls)
}

export type HallGroup = { key: string; label: string; entries: Entry[] }

/**
 * A collection grouped by fair hall (the part of the booth before "-", or a hall number alone): halls
 * in order, numbered ones first; inside a hall the games with a booth by booth, then the games with
 * only the hall by name. A game with booths in several halls appears in each, once; games without a
 * booth come last ("No booth yet"). It groups exactly the games it is given: the screen filters first.
 */
export function groupByHall(entries: Entry[], nameOf: (entry: Entry) => string): HallGroup[] {
  const live = entries.filter(e => !e.deleted)
  const byHall = new Map<string, { entry: Entry; booth: string | null }[]>()
  const none: Entry[] = []
  for (const entry of live) {
    const places = placesOf(entry.facts?.booth)
    if (places.length === 0) {
      none.push(entry)
      continue
    }
    for (const hall of new Set(places.map(p => p.hall))) {
      const booth = places.find(p => p.hall === hall && p.booth)?.booth ?? null
      byHall.set(hall, [...(byHall.get(hall) ?? []), { entry, booth }])
    }
  }
  const byBooth = (a: { entry: Entry; booth: string | null }, b: { entry: Entry; booth: string | null }) => {
    if (a.booth && b.booth) return a.booth.localeCompare(b.booth, 'en', { numeric: true }) || nameOf(a.entry).localeCompare(nameOf(b.entry))
    if (a.booth || b.booth) return a.booth ? -1 : 1
    return nameOf(a.entry).localeCompare(nameOf(b.entry))
  }
  const groups: HallGroup[] = [...byHall.keys()].sort(compareHalls).map(hall => ({
    key: hall,
    label: isNumber(hall) ? `Hall ${hall}` : hall,
    entries: byHall.get(hall)!.sort(byBooth).map(x => x.entry),
  }))
  if (none.length > 0) groups.push({ key: 'none', label: 'No booth yet', entries: none.sort((a, b) => nameOf(a).localeCompare(nameOf(b))) })
  return groups
}
