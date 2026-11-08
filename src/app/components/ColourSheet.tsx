import { NO_STATUS, PALETTE, type PaletteName, STATUS_NAMES, type StatusKey } from '../../domain/bgg-status.ts'
import { useServices } from '../context.tsx'
import { Badge, useBgg } from './BggBadges.tsx'
import { Sheet } from './Sheet.tsx'

export const PALETTE_NAMES: Record<PaletteName, string> = {
  cool: 'Cool',
  hot: 'Hot',
  mint: 'Mint',
  pink: 'Pink',
  white: 'White',
  violet: 'Violet',
  dusk: 'Dusk',
  red: 'Red',
  mud: 'Mud',
  grey: 'Grey',
}

/** A sample of a status for its badge: the Wishlist shows a priority ("Wishlist 1"). */
export const SAMPLE = { ...NO_STATUS, wishlist: 1 as const }

/**
 * F008 (docs/design.md "Badge colours"): "Colour of “<status>”": the badge preview, ten hexagon swatches
 * with their names in a 5×2 grid (the current one with an orange rim and ✓); a tap applies at once and
 * is remembered on the device; Done.
 */
export function ColourSheet({ status, onClose }: { status: StatusKey; onClose: () => void }) {
  const { store } = useServices()
  const { colours } = useBgg()
  const pick = (colour: PaletteName) => void store.setMeta('badgeColours', { ...colours, [status]: colour })
  return (
    <Sheet open title={`Colour of “${STATUS_NAMES[status]}”`} onClose={onClose}>
      <p className="colour-preview">
        <Badge statusKey={status} status={SAMPLE} colours={colours} />
      </p>
      <div className="swatches" role="group" aria-label="Colour">
        {PALETTE.map(colour => {
          const on = colours[status] === colour
          return (
            <div key={colour}>
              <span className={`ring${on ? ' on' : ''}`}>
                <button type="button" data-colour={colour} aria-label={PALETTE_NAMES[colour]} aria-pressed={on} onClick={() => pick(colour)}>
                  {on ? '✓' : ''}
                </button>
              </span>
              <span aria-hidden="true">{PALETTE_NAMES[colour]}</span>
            </div>
          )
        })}
      </div>
      <div className="sheet-actions">
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Done
        </button>
      </div>
    </Sheet>
  )
}
