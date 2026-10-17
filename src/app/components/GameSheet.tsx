import type { Game } from '../../client/types.ts'
import { gameUrl } from '../../domain/bgg-link.ts'
import type { Collection, Entry } from '../../domain/collection.ts'
import { MARKS, type Mark } from '../../domain/marks.ts'
import { removeGame, setMark } from '../actions.ts'
import { useServices } from '../context.tsx'
import { HexCover } from './HexCover.tsx'
import { HexPicker } from './HexPicker.tsx'
import { Sheet } from './Sheet.tsx'
import { useToast } from './Toast.tsx'

const PICKER = MARKS.filter(m => m.key !== 'new' && m.key !== 'skip').map(m => ({
  key: m.key,
  label: m.label,
  tone: m.key,
  icon: (
    <em className="picker-emoji" aria-hidden="true">
      {m.emoji}
    </em>
  ),
}))

/** Game details in a collection (FR-006, FR-018): cover, name, year, BGG link, mark picker, remove. */
export function GameSheet({ entry, game, collection, onClose }: { entry: Entry; game?: Game; collection: Collection; onClose: () => void }) {
  const services = useServices()
  const toast = useToast()
  const name = game?.name ?? `Game ${entry.bggId}`
  const mark = (key: Mark) => void setMark(services, entry, key)
  const remove = async () => {
    await removeGame(services, entry)
    onClose()
    toast(`Removed ${name} from ${collection.name}`)
  }
  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="detail-head">
        <HexCover game={game} name={name} pending={entry.detailsPending && !game?.thumbnailUrl} bought={entry.bought} size={84} />
        <div>
          <p className="detail-sub">
            {game?.year ? `${game.year} · ${collection.name}` : entry.detailsPending ? 'Details follow from BoardGameGeek' : `Year unknown · ${collection.name}`}
          </p>
          <a className="link-out" href={gameUrl(entry.bggId)} target="_blank" rel="noopener noreferrer">
            Open on BoardGameGeek
          </a>
        </div>
      </div>
      <HexPicker label="Mark as" options={PICKER} value={entry.mark} onPick={mark} />
      <div className="sheet-actions">
        {entry.mark === 'skip' ? (
          <button type="button" className="btn btn-block" onClick={() => mark('new')}>
            Mark as not yet decided
          </button>
        ) : (
          <button type="button" className="btn btn-block" onClick={() => mark('skip')}>
            🛑 Not interested
          </button>
        )}
        <button type="button" className="btn btn-block btn-danger" onClick={() => void remove()}>
          Remove from collection
        </button>
        <button type="button" className="btn btn-block" onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  )
}
