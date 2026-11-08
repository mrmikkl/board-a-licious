import { type ReactNode, createContext, useContext, useMemo } from 'react'

import { DEFAULT_BADGE_COLOURS, type PaletteName, type Status, type StatusKey, badges, label } from '../../domain/bgg-status.ts'
import { useStoreData } from '../context.tsx'
import { statusMap } from '../hooks/bgg-collection-state.ts'
import { useBggCollection } from '../hooks/useBggCollection.ts'

type Bgg = {
  /** The person's BGG username, or null. */
  username: string | null
  /** The statuses of the person's own BGG collection by BGG id (never a friend's). */
  statuses: Map<number, Status>
  /** The own collection has been read (so a game without statuses is known to be not in it). */
  known: boolean
  colours: Record<StatusKey, PaletteName>
}

const NONE: Bgg = { username: null, statuses: new Map(), known: false, colours: DEFAULT_BADGE_COLOURS }
const BggContext = createContext<Bgg>(NONE)

/**
 * F008: the person's own BGG statuses and badge colours for every badge on screen, read once for the
 * app (FR-008); without a username there are none.
 */
export function BggProvider({ children }: { children: ReactNode }) {
  const username = useStoreData(store => store.bggUsername()) ?? null
  const colours = useStoreData(store => store.metaOrDefault('badgeColours')) ?? DEFAULT_BADGE_COLOURS
  const { collection } = useBggCollection(username)
  const value = useMemo<Bgg>(
    () => ({
      username,
      statuses: statusMap(collection),
      known: Boolean(username && collection?.loadedAt && !collection.error),
      colours,
    }),
    [username, collection, colours],
  )
  return <BggContext.Provider value={value}>{children}</BggContext.Provider>
}

export const useBgg = () => useContext(BggContext)

/** The status and its badge colour as attributes for `theme/badges.css`. */
export const colourOf = (colours: Bgg['colours'], key: StatusKey) => ({ 'data-colour': colours[key] ?? DEFAULT_BADGE_COLOURS[key] })

/** One badge pill (docs/design.md "BGG status badge"); decorative, the group carries the name. */
export function Badge({ statusKey, status, colours }: { statusKey: StatusKey; status: Status; colours: Bgg['colours'] }) {
  return (
    <span className="bb" {...colourOf(colours, statusKey)} aria-hidden="true">
      {label(statusKey, status)}
    </span>
  )
}

/**
 * F008 (docs/design.md "BGG status badge"): what the person's BGG collection says about a game, as text
 * pills in badge order; rows show `max` (two) plus "+n", the game sheet all (`big`). One accessible name
 * for all: "On BoardGameGeek: Owned, Wishlist 2". Nothing without a username or a status.
 */
export function BggBadges({ bggId, max, big = false, id }: { bggId: number; max?: number; big?: boolean; id?: string }) {
  const { statuses, colours } = useBgg()
  const status = statuses.get(bggId)
  if (!status) return null
  const all = badges(status)
  if (all.shown.length === 0) return null
  const { shown, rest } = badges(status, max)
  return (
    <span className={`bgg-badges${big ? ' big' : ''}`} id={id} role="img" aria-label={`On BoardGameGeek: ${all.shown.map(key => label(key, status)).join(', ')}`}>
      {shown.map(key => (
        <Badge key={key} statusKey={key} status={status} colours={colours} />
      ))}
      {rest > 0 && (
        <span className="bb more" aria-hidden="true">
          +{rest}
        </span>
      )}
    </span>
  )
}

/** Whether a game shows badges, so a row can point its description at them. */
export function useHasBadges(bggId: number) {
  const status = useBgg().statuses.get(bggId)
  return Boolean(status && badges(status).shown.length > 0)
}
