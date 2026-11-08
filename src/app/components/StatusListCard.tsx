import { STATUS_NAMES, type StatusKey } from '../../domain/bgg-status.ts'
import { navigate } from '../router.ts'
import { colourOf, useBgg } from './BggBadges.tsx'

/** A symbol per status for its card's hexagon (decorative; the name says it). */
export const STATUS_EMOJI: Record<StatusKey, string> = {
  own: '📦',
  preordered: '⏱️',
  wishlist: '🎁',
  wantToPlay: '🎲',
  forTrade: '🔁',
  wantInTrade: '🤝',
  wantToBuy: '🛒',
  prevOwned: '📤',
}

export const gamesText = (n: number) => `${n} ${n === 1 ? 'game' : 'games'}`

/**
 * F008 (docs/design.md "Status list card"): a solid 60px tile in Lists › Status lists: the status's
 * hexagon in its badge colour with its emoji, the name (Wishlist: "by priority, 1 Must have first"), the
 * count and an orange ›. Button "<status>, <n> games" (contracts/ui.md); opens the status list.
 */
export function StatusListCard({ bggUser, status, count }: { bggUser: string; status: StatusKey; count: number }) {
  const { colours } = useBgg()
  return (
    <button
      type="button"
      className="status-card"
      aria-label={`${STATUS_NAMES[status]}, ${gamesText(count)}`}
      onClick={() => navigate({ name: 'status-list', bggUser, status })}
    >
      <span className="status-hex" {...colourOf(colours, status)} aria-hidden="true">
        {STATUS_EMOJI[status]}
      </span>
      <span className="status-name">
        {STATUS_NAMES[status]}
        {status === 'wishlist' && <small>by priority, 1 Must have first</small>}
      </span>
      <span className="status-count">{count}</span>
      <span className="status-chev" aria-hidden="true">
        ›
      </span>
    </button>
  )
}
