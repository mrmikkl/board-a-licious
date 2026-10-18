import { useState } from 'react'

import type { Game } from '../../client/types.ts'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('') || '?'

/**
 * A game cover in a hexagon; initials while details are pending, without a cover, or when the cover
 * cannot load (offline and not in the browser cache) (docs/design.md §11).
 * Decorative: the game's name is always shown next to it.
 */
export function HexCover({ game, name, pending = false, bought = false, size = 52 }: { game?: Game; name: string; pending?: boolean; bought?: boolean; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  const url = !pending ? game?.thumbnailUrl : null
  const src = url && url !== failed ? url : null
  return (
    <span className="cover" style={{ width: size, height: Math.round(size * 1.12) }} aria-hidden="true">
      <span className="cover-hex hex">
        {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : <span className="cover-initials">{initials(name)}</span>}
      </span>
      {bought && <span className="cover-got">✓</span>}
    </span>
  )
}
