import { type ReactNode, useId } from 'react'

import type { Game } from '../../client/types.ts'
import { BggBadges, useHasBadges } from './BggBadges.tsx'
import { HexCover } from './HexCover.tsx'

/** "2021" or "Year unknown" (docs/design.md "Search result row"). */
export const yearText = (year: number | null | undefined) => (year ? String(year) : 'Year unknown')

/**
 * F008 (docs/design.md "List game row"): a game in a search result, preview, geeklist or status list. The
 * left part opens the game sheet: cover, name, year (left out when `year` is undefined) and Expansion, in
 * teal where the person has it (`inText`), an optional `info` line, then the BGG status badges; inside the row at
 * the right one action, Add, which opens the add to shopping lists sheet. Accessible name
 * "<game>, <year>[, expansion]" (contracts/ui.md).
 */
export function ListGameRow({
  bggId: id,
  name,
  year,
  expansion = false,
  game,
  cover,
  inText,
  info,
  onOpen,
  onAdd,
}: {
  /** The game's BGG id when neither `game` nor `cover` is given (for its badges). */
  bggId?: number
  name: string
  year?: number | null
  expansion?: boolean
  game?: Game
  /** Stands in for the game's cover until the details are on the device. */
  cover?: Pick<Game, 'bggId' | 'name' | 'thumbnailUrl'>
  inText?: string
  info?: ReactNode
  onOpen: () => void
  /** Add to shopping lists; without it the row has no action (Buy › Search: one game, its prices). */
  onAdd?: () => void
}) {
  const inId = useId()
  const badgesId = useId()
  const bggId = id ?? game?.bggId ?? cover?.bggId ?? 0
  const hasBadges = useHasBadges(bggId)
  const describedBy = [inText && inId, hasBadges && badgesId].filter(Boolean).join(' ') || undefined
  const label = [name, year !== undefined && yearText(year), expansion && 'expansion'].filter(Boolean).join(', ')
  const coverGame = game ?? (cover && { ...cover, year: null, description: null, kind: 'boardgame' as const })
  return (
    <div className="row list-row" data-mark="new">
      <button type="button" className="row-open" aria-label={label} aria-describedby={describedBy} onClick={onOpen}>
        <HexCover game={coverGame} name={name} size={52} />
        <span className="row-meta">
          <span className="row-name">{name}</span>
          {(year !== undefined || expansion) && (
            <span className="row-sub">
              {year !== undefined && yearText(year)}
              {expansion && <span className="kind-pill">Expansion</span>}
            </span>
          )}
          {info}
          {inText && (
            <span className="in-mark" id={inId}>
              {inText}
            </span>
          )}
          <BggBadges bggId={bggId} max={2} id={badgesId} />
        </span>
      </button>
      {onAdd && (
        <div className="row-acts">
          <button type="button" className="row-act add" aria-label={`Add ${name} to shopping lists`} onClick={onAdd}>
            <span className="row-act-hex" aria-hidden="true">
              +
            </span>
            <span className="row-act-label">Add</span>
          </button>
        </div>
      )}
    </div>
  )
}
