import type { ListEntryFacts } from '../../client/types.ts'
import { formatMoney } from '../../domain/money.ts'

/** "…" while the publisher's name is still being looked up on BoardGameGeek. */
const publisherOf = (facts: ListEntryFacts) => facts.publisher ?? (facts.publisherId != null ? '…' : null)

/**
 * Booth · price · publisher of a preview entry, as in the game rows (docs/design.md §7). About half
 * the preview has no booth yet (publishers add them before the fair), which the row says outright.
 */
export function factsLine(facts: ListEntryFacts | undefined): string {
  if (!facts) return ''
  return [facts.booth || 'No booth yet', facts.priceCents != null ? formatMoney(facts.priceCents, facts.currency) : null, publisherOf(facts)].filter(Boolean).join(' · ')
}

/** Booth, price and publisher of a preview entry in the list game sheet. */
export function FactsList({ facts }: { facts: ListEntryFacts | undefined }) {
  const publisher = facts ? publisherOf(facts) : null
  return (
    <dl className="facts">
      <div>
        <dt>Booth</dt>
        <dd>{facts?.booth ?? 'Not known yet'}</dd>
      </div>
      <div>
        <dt>Price</dt>
        <dd>{facts?.priceCents != null ? formatMoney(facts.priceCents, facts.currency) : 'Not known yet'}</dd>
      </div>
      <div>
        <dt>Publisher</dt>
        <dd>{publisher ?? 'Not known yet'}</dd>
      </div>
    </dl>
  )
}
