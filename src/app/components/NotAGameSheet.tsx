import { Sheet } from './Sheet.tsx'

/**
 * F002: what opens when the shared page is no BoardGameGeek game (docs/design.md v1.9.0 "Shared
 * game"): why nothing can be added, the shared link, Close / Add game by link.
 */
export function NotAGameSheet({ shown, onClose, onAddByLink }: { shown: string; onClose: () => void; onAddByLink: () => void }) {
  return (
    <Sheet open title="Not a BoardGameGeek game" onClose={onClose}>
      <p className="lead">The shared page is not a game on boardgamegeek.com, so there is nothing to add.</p>
      {shown && (
        <p className="hint" style={{ overflowWrap: 'anywhere' }}>
          {shown}
        </p>
      )}
      <div className="sheet-actions sheet-actions-row">
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={onAddByLink}>
          Add game by link
        </button>
      </div>
    </Sheet>
  )
}
