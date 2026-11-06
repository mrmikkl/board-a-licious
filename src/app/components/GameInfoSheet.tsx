import { useState } from 'react'

import type { Game } from '../../client/types.ts'
import { gameUrl } from '../../domain/bgg-link.ts'
import type { SearchResult } from '../../domain/bgg-search.ts'
import { InfoList } from './GameInfo.tsx'
import { HexCover } from './HexCover.tsx'
import { ImageViewer } from './ImageViewer.tsx'
import { yearText } from './SearchResultRow.tsx'
import { Sheet } from './Sheet.tsx'

/**
 * F006: a search result's game info only (docs/design.md "Game info sheet"): cover with the image
 * viewer, year and publisher, the info box and the description. No collections and no adding here.
 */
export function GameInfoSheet({ result, game, onClose }: { result: SearchResult; game?: Game; onClose: () => void }) {
  const [viewer, setViewer] = useState(false)
  const name = game?.name || result.name
  const sub = [yearText(game?.year ?? result.year), result.kind === 'expansion' && 'Expansion', game?.publisher].filter(Boolean).join(' · ')
  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="detail-head">
        <button type="button" className="cover-zoom" aria-label={`Show the images of ${name} big`} onClick={() => setViewer(true)}>
          <HexCover game={game} name={name} size={84} />
        </button>
        <div>
          <p className="detail-sub">{sub}</p>
          <a className="link-out" href={gameUrl(result.bggId)} target="_blank" rel="noopener noreferrer">
            Open on BoardGameGeek
          </a>
        </div>
      </div>
      <p className="description">{game ? game.description || 'BoardGameGeek has no description for this game.' : 'Loading the details from BoardGameGeek…'}</p>
      {game && (
        <div className="facts-box">
          <InfoList details={game} />
          <div className="facts-foot">
            <span className="facts-by">From BoardGameGeek</span>
          </div>
        </div>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn btn-block" onClick={onClose}>
          Close
        </button>
      </div>
      {viewer && <ImageViewer game={{ bggId: result.bggId, name }} cover={game?.thumbnailUrl ?? null} pending={!game} onClose={() => setViewer(false)} />}
    </Sheet>
  )
}
