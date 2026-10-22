import type { Game } from '../../client/types.ts'
import type { Entry } from '../../domain/collection.ts'
import { publisherOf } from '../../domain/game-info.ts'
import { markInfo } from '../../domain/marks.ts'
import { formatMoney } from '../../domain/money.ts'
import { InfoLine } from './GameInfo.tsx'
import { HexCover } from './HexCover.tsx'
import { IconBag, IconBagCheck, IconCategory } from './icons.tsx'

/**
 * A game in a collection (docs/design.md v2.2.0 "Game row", F005 R3): a tile whose 1px border has the
 * category's gradient. The open button (cover, name, publisher, infos) opens the details; on the right
 * the row's own actions, Buy and Category. Buttons cannot nest, so the actions sit beside the open
 * button, not in it. `justAdded` keeps the hover highlight on it (F002 "Just added").
 */
export function GameRow({
  entry,
  game,
  onOpen,
  onBuy,
  onCategory,
  justAdded = false,
}: {
  entry: Entry
  game?: Game
  onOpen: () => void
  onBuy: () => void
  onCategory: () => void
  justAdded?: boolean
}) {
  const name = game?.name ?? `Game ${entry.bggId}`
  const category = markInfo(entry.mark).label
  const publisher = publisherOf(entry.facts, game)
  const waiting = entry.detailsPending && !game?.year
  const paid = entry.paidCents != null ? formatMoney(entry.paidCents, entry.paidCurrency) : 'Bought'
  return (
    <div className={`row${entry.mark === 'skip' ? ' skip' : ''}${justAdded ? ' is-just-added' : ''}`} data-mark={entry.mark}>
      <button type="button" className="row-open" onClick={onOpen} aria-label={`${name}, ${category}${entry.bought ? ', bought' : ''}`}>
        <HexCover game={game} name={name} pending={entry.detailsPending && !game?.thumbnailUrl} bought={entry.bought} />
        <span className="row-meta">
          <span className="row-name">
            {name}
            {game?.year ? <span className="row-year"> {game.year}</span> : null}
          </span>
          {publisher ? <span className="row-sub">{publisher}</span> : waiting && <span className="row-sub">Details follow from BoardGameGeek</span>}
          <InfoLine facts={entry.facts} details={game} />
        </span>
      </button>
      <div className="row-acts">
        <button type="button" className="row-act buy" aria-pressed={entry.bought} aria-label={`${entry.bought ? 'Not bought' : 'Buy'} ${name}`} onClick={onBuy}>
          <span className="row-act-hex">{entry.bought ? <IconBagCheck /> : <IconBag />}</span>
          <span className="row-act-label">{entry.bought ? paid : 'Buy'}</span>
        </button>
        <button type="button" className="row-act cat" aria-label={`Category of ${name}`} onClick={onCategory}>
          <span className="row-act-hex">
            <IconCategory />
          </span>
          <span className="row-act-label">Category</span>
        </button>
      </div>
    </div>
  )
}
