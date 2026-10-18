import type { Game } from '../../client/types.ts'
import type { Entry } from '../../domain/collection.ts'
import { publisherOf } from '../../domain/game-info.ts'
import { markInfo } from '../../domain/marks.ts'
import { formatMoney } from '../../domain/money.ts'
import { InfoLine } from './GameInfo.tsx'
import { HexCover } from './HexCover.tsx'

/**
 * A game in a collection (docs/design.md §7): hexagon cover; name and year; publisher; the first three
 * infos (FR-010); mark pill and bought pill.
 */
export function GameRow({ entry, game, onOpen }: { entry: Entry; game?: Game; onOpen: () => void }) {
  const name = game?.name ?? `Game ${entry.bggId}`
  const mark = markInfo(entry.mark)
  const publisher = publisherOf(entry.facts, game)
  const waiting = entry.detailsPending && !game?.year
  return (
    <button type="button" className={`row${entry.mark === 'skip' ? ' skip' : ''}`} onClick={onOpen}>
      <HexCover game={game} name={name} pending={entry.detailsPending && !game?.thumbnailUrl} bought={entry.bought} />
      <span className="row-meta">
        <span className="row-name">
          {name}
          {game?.year ? <span className="row-year"> {game.year}</span> : null}
        </span>
        {publisher ? <span className="row-sub">{publisher}</span> : waiting && <span className="row-sub">Details follow from BoardGameGeek</span>}
        <InfoLine facts={entry.facts} details={game} />
      </span>
      {entry.bought && (
        <span className="pill" data-mark="bought">
          ✅{entry.paidCents != null ? ` ${formatMoney(entry.paidCents, entry.paidCurrency)}` : ''}
          <span className="visually-hidden"> bought</span>
        </span>
      )}
      {entry.mark !== 'new' && entry.mark !== 'skip' && (
        <span className="pill mark-pill" data-mark={entry.mark} aria-hidden="true">
          {mark.emoji}
        </span>
      )}
    </button>
  )
}
