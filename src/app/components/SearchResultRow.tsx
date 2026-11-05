import { useId } from 'react'

import type { Game } from '../../client/types.ts'
import type { SearchResult } from '../../domain/bgg-search.ts'
import { HexCover } from './HexCover.tsx'

/** "2021" or "Year unknown" (docs/design.md "Search result row"). */
export const yearText = (year: number | null | undefined) => (year ? String(year) : 'Year unknown')

/** The accessible name of a result: "<game>, <year>[, expansion]" (contracts/ui.md). */
export const resultLabel = (name: string, result: SearchResult) => `${name}, ${yearText(result.year)}${result.kind === 'expansion' ? ', expansion' : ''}`

/**
 * F006: a game found on BoardGameGeek: cover (initials until the details arrive), name, year, Expansion,
 * where the person already has it; a big + beside it adds it to collections. `compact` (Add game's
 * matches) is one smaller button without the +.
 */
export function SearchResultRow({
  result,
  game,
  inText,
  compact = false,
  onOpen,
  onAdd,
}: {
  result: SearchResult
  game?: Game
  inText?: string | null
  compact?: boolean
  onOpen: () => void
  onAdd?: () => void
}) {
  const inId = useId()
  // the details bring BGG's primary name where the search matched another one (research R5)
  const name = game?.name || result.name
  return (
    <>
      <button
        type="button"
        className={compact ? 'row srow compact' : 'row srow'}
        aria-label={resultLabel(name, result)}
        aria-describedby={inText ? inId : undefined}
        onClick={onOpen}
      >
        <HexCover game={game} name={name} size={compact ? 40 : 52} />
        <span className="row-meta">
          <span className="row-name">{name}</span>
          <span className="row-sub">
            {yearText(result.year)}
            {result.kind === 'expansion' && <span className="kind-pill">Expansion</span>}
          </span>
          {inText && (
            <span className="in-mark" id={inId}>
              {inText}
            </span>
          )}
        </span>
      </button>
      {!compact && onAdd && (
        <button type="button" className="add-mini hex-btn" aria-label={`Add ${name} to a collection`} onClick={onAdd}>
          <span className="hex" aria-hidden="true">
            +
          </span>
        </button>
      )}
    </>
  )
}
