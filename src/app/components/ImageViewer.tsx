import { useEffect } from 'react'

/**
 * SKELETON (F004 swarm): the final props of the image viewer (docs/design.md "Image viewer",
 * contracts/images-api.md). Worker A replaces the body with the real viewer; Show-off uses only the props.
 */
export type ImageViewerProps = {
  /** the game shown: its BGG id (for the gallery) and name */
  game: { bggId: number; name: string }
  /** the cover already on the phone, shown at once (null: initials) */
  cover: string | null
  /** details not loaded yet: no gallery, a note instead */
  pending?: boolean
  onClose: () => void
}

export function ImageViewer({ game, onClose }: ImageViewerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Images of ${game.name}`}>
      <button type="button" className="viewer-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
    </div>
  )
}
