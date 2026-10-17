import type { Game } from '../../client/types.ts'
import type { Entry } from '../../domain/collection.ts'
import { markInfo } from '../../domain/marks.ts'
import { formatMoney } from '../../domain/money.ts'
import { HexCover } from './HexCover.tsx'

function subline(entry: Entry, game?: Game) {
  const facts = entry.facts
  if (facts && (facts.booth || facts.priceCents != null || facts.publisher)) {
    return [facts.booth, facts.priceCents != null ? formatMoney(facts.priceCents, facts.currency) : null, facts.publisher].filter(Boolean).join(' · ')
  }
  if (entry.detailsPending && !game?.year) return 'Details follow from BoardGameGeek'
  return game?.year ? String(game.year) : 'Year unknown'
}

/** A game in a collection: hexagon cover, name, facts or year, mark pill and bought pill (docs/design.md §7). */
export function GameRow({ entry, game, onOpen }: { entry: Entry; game?: Game; onOpen: () => void }) {
  const name = game?.name ?? `Game ${entry.bggId}`
  const mark = markInfo(entry.mark)
  return (
    <button type="button" className={`row${entry.mark === 'skip' ? ' skip' : ''}`} onClick={onOpen}>
      <HexCover game={game} name={name} pending={entry.detailsPending && !game?.thumbnailUrl} bought={entry.bought} />
      <span className="row-meta">
        <span className="row-name">{name}</span>
        <span className="row-sub">{subline(entry, game)}</span>
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
