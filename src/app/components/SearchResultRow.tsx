import type { Game } from '../../client/types.ts'
import type { SearchResult } from '../../domain/bgg-search.ts'
import { HexCover } from './HexCover.tsx'
import { yearText } from './ListGameRow.tsx'

/** The accessible name of a result: "<game>, <year>[, expansion]" (contracts/ui.md). */
export const resultLabel = (name: string, result: SearchResult) => `${name}, ${yearText(result.year)}${result.kind === 'expansion' ? ', expansion' : ''}`

/**
 * F006: a compact search result inside Add game (docs/design.md "Search result row": smaller cover, no
 * shadow, no Add): one button with the cover (once the game was opened), name, year and Expansion.
 */
export function SearchResultRow({ result, game, onOpen }: { result: SearchResult; game?: Game; onOpen: () => void }) {
  // the details bring BGG's primary name where the search matched another one (research R5)
  const name = game?.name || result.name
  return (
    <button type="button" className="row srow compact" aria-label={resultLabel(name, result)} onClick={onOpen}>
      <HexCover game={game} name={name} size={40} />
      <span className="row-meta">
        <span className="row-name">{name}</span>
        <span className="row-sub">
          {yearText(result.year)}
          {result.kind === 'expansion' && <span className="kind-pill">Expansion</span>}
        </span>
      </span>
    </button>
  )
}
