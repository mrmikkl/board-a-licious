import { type CSSProperties, useEffect, useState } from 'react'

import { type CelebrateKind, type Particle, type Point, burstParticles, onCelebrate } from '../celebrate.ts'

type Party = { id: number; kind: CelebrateKind; from: Point; particles: Particle[] }

const LIFETIME_MS = 1100

/**
 * The overlay for bursts and the "GOT IT!" stamp (docs/design.md §9). Visual only: no pointer
 * events, hidden from screen readers (the toast or the new state says it), off with reduced motion.
 */
export function Celebrate() {
  const [parties, setParties] = useState<Party[]>([])
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let next = 0
    const timers = new Set<number>()
    const stop = onCelebrate(({ kind, from }) => {
      if (reduced.matches) return
      const id = next++
      const party = { id, kind, from: from ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }, particles: burstParticles(kind) }
      setParties(current => [...current, party])
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        setParties(current => current.filter(p => p.id !== id))
      }, LIFETIME_MS)
      timers.add(timer)
    })
    return () => {
      stop()
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [])
  if (parties.length === 0) return null
  return (
    <div className="celebrate" aria-hidden="true">
      {parties.map(party => (
        <div key={party.id} className="burst" style={{ left: party.from.x, top: party.from.y }}>
          {party.particles.map((p, i) => {
            const radians = (p.angle * Math.PI) / 180
            const style = {
              '--dx': `${Math.cos(radians) * p.distance}px`,
              '--dy': `${Math.sin(radians) * p.distance}px`,
              '--size': `${p.size}px`,
              background: p.colour,
            } as CSSProperties
            return <i key={i} className="burst-hex" style={style} />
          })}
        </div>
      ))}
      {parties.some(p => p.kind === 'bought') && (
        <div key={parties.findLast(p => p.kind === 'bought')?.id} className="got-stamp">
          GOT IT!
        </div>
      )}
    </div>
  )
}
