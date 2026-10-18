import type { Collection, Entry } from '../../domain/collection.ts'
import { countMarks } from '../../domain/collection.ts'
import { MARKS } from '../../domain/marks.ts'
import { href } from '../router.ts'
import { Counter } from './Counter.tsx'

/** A collection with the number of games per mark and bought (FR-002). */
export function CollectionCard({ collection, entries }: { collection: Collection; entries: Entry[] }) {
  const counts = countMarks(entries)
  return (
    <a className="card collection-card" href={href({ name: 'collection', id: collection.id })}>
      <span className="cluster" aria-hidden="true">
        <i className="hex" />
        <i className="hex" />
        <i className="hex" />
      </span>
      <h2 className="card-title">
        <span className="card-name">{collection.name}</span>
      </h2>
      <p className="card-sub">{counts.total === 0 ? 'No games yet' : counts.byMark.new > 0 ? `${counts.byMark.new} not marked` : 'All marked'}</p>
      <p className="counts">
        {MARKS.filter(m => m.key !== 'new' && m.key !== 'skip').map(m => (
          <span key={m.key}>
            <span aria-hidden="true">{m.emoji}</span> <Counter value={counts.byMark[m.key]} />
            <span className="visually-hidden"> {m.label}</span>
          </span>
        ))}
        <span>
          <span aria-hidden="true">✅</span> <Counter value={counts.bought} />
          <span className="visually-hidden"> bought</span>
        </span>
        <span>
          <span aria-hidden="true">🛑</span> <Counter value={counts.byMark.skip} />
          <span className="visually-hidden"> not interested</span>
        </span>
      </p>
    </a>
  )
}
