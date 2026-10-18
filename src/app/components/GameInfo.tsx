import type { Facts } from '../../domain/collection.ts'
import { type GameDetails, gameInfos, rowInfos } from '../../domain/game-info.ts'

type Source = { facts?: Facts | null; details?: Partial<GameDetails> | null }

const Mechanisms = ({ items }: { items: string[] }) => (
  <span className="info-pills">
    {items.map(m => (
      <span key={m} className="pill info-pill">
        {m}
      </span>
    ))}
  </span>
)

/** The third line of a game row: the first three infos (FR-010), mechanisms as pills. */
export function InfoLine({ facts, details }: Source) {
  const infos = rowInfos(facts, details)
  if (infos.length === 0) return null
  const plain = infos.filter(i => !i.items)
  const mechanisms = infos.find(i => i.items)
  return (
    <span className="row-info">
      {plain.length > 0 && <span>{plain.map(i => i.text).join(' · ')}</span>}
      {mechanisms?.items && <Mechanisms items={mechanisms.items} />}
    </span>
  )
}

/** The publisher, then every info a game has in the order of FR-010: game details, swipe card. */
export function InfoList({ facts, details, publisher }: Source & { publisher?: string | null }) {
  const infos = gameInfos(facts, details)
  if (infos.length === 0 && !publisher) return null
  return (
    <dl className="info-list">
      {publisher && (
        <div>
          <dt>Publisher</dt>
          <dd>{publisher}</dd>
        </div>
      )}
      {infos.map(i => (
        <div key={i.key}>
          <dt>{i.label}</dt>
          <dd>{i.items ? <Mechanisms items={i.items} /> : i.key === 'booth' ? i.text.replace(/^Booth /, '') : i.text}</dd>
        </div>
      ))}
    </dl>
  )
}
