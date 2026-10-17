import { describe, expect, it } from 'vitest'

import { BURST_COLOURS, type CelebrateDetail, burstParticles, celebrate, onCelebrate, rollValue } from '../../src/app/celebrate.ts'

/** Always returns the same number, so particles land exactly where the formula puts them. */
const fixed = (value: number) => () => value

const hex = (colour: string) => Number.parseInt(colour.slice(1), 16)
const channels = (colour: string) => [(hex(colour) >> 16) & 255, (hex(colour) >> 8) & 255, hex(colour) & 255]

describe('burst particles', () => {
  it('makes about 20 small hexagons', () => {
    expect(burstParticles('must_have')).toHaveLength(20)
    expect(burstParticles('bought', { count: 12 })).toHaveLength(12)
  })

  it('spreads them all around the circle, one per slice', () => {
    const particles = burstParticles('must_have', { random: fixed(0.5) })
    // with the jitter centred, each particle sits in the middle of its slice of 360°/20 = 18°
    expect(particles.map(p => p.angle)).toEqual(Array.from({ length: 20 }, (_, i) => i * 18 + 9))
  })

  it('keeps each angle inside its slice whatever the random numbers', () => {
    for (const r of [0, 0.999]) {
      burstParticles('must_have', { random: fixed(r) }).forEach((p, i) => {
        expect(p.angle).toBeGreaterThanOrEqual(i * 18)
        expect(p.angle).toBeLessThan((i + 1) * 18)
      })
    }
  })

  it('flies them a short distance, with small sizes', () => {
    const near = burstParticles('must_have', { random: fixed(0) })
    const far = burstParticles('must_have', { random: fixed(0.999) })
    for (const p of [...near, ...far]) {
      expect(p.distance).toBeGreaterThanOrEqual(60)
      expect(p.distance).toBeLessThanOrEqual(140)
      expect(p.size).toBeGreaterThanOrEqual(8)
      expect(p.size).toBeLessThanOrEqual(16)
    }
    expect(near[0]?.distance).toBeLessThan(far[0]?.distance ?? 0)
  })

  it('colours Must Have from the hot gradient and Bought from the got gradient', () => {
    expect(burstParticles('must_have', { random: fixed(0) })[0]?.colour).toBe(BURST_COLOURS.must_have[0])
    expect(burstParticles('bought', { random: fixed(0) })[0]?.colour).toBe(BURST_COLOURS.bought[0])
    expect(BURST_COLOURS.must_have).toEqual(['#ff7a1a', '#ffb020'])
    expect(BURST_COLOURS.bought).toEqual(['#0fb98f', '#7cf0c5'])
  })

  it('mixes colours between the two ends of the gradient', () => {
    const [from, to] = BURST_COLOURS.must_have.map(channels) as [number[], number[]]
    for (const r of [0, 0.3, 0.7, 0.999]) {
      const colour = burstParticles('must_have', { random: fixed(r) })[0]?.colour ?? ''
      expect(colour).toMatch(/^#[0-9a-f]{6}$/)
      channels(colour).forEach((c, i) => {
        expect(c).toBeGreaterThanOrEqual(Math.min(from[i] ?? 0, to[i] ?? 0))
        expect(c).toBeLessThanOrEqual(Math.max(from[i] ?? 0, to[i] ?? 0))
      })
    }
  })
})

describe('rolling counter', () => {
  it('starts at the old value and ends at the new one after 650 ms', () => {
    expect(rollValue(2, 7, 0)).toBe(2)
    expect(rollValue(2, 7, 650)).toBe(7)
    expect(rollValue(2, 7, 2000)).toBe(7)
  })

  it('passes through whole numbers in between, never overshooting', () => {
    const steps = Array.from({ length: 14 }, (_, i) => rollValue(0, 10, i * 50))
    steps.forEach(n => expect(Number.isInteger(n)).toBe(true))
    steps.slice(1).forEach((n, i) => expect(n).toBeGreaterThanOrEqual(steps[i] ?? 0))
    expect(Math.max(...steps)).toBeLessThanOrEqual(10)
    expect(rollValue(0, 10, 325)).toBeGreaterThan(0)
    expect(rollValue(0, 10, 325)).toBeLessThan(10)
  })

  it('rolls down as well', () => {
    expect(rollValue(5, 1, 0)).toBe(5)
    const middle = rollValue(5, 1, 300)
    expect(middle).toBeLessThan(5)
    expect(middle).toBeGreaterThanOrEqual(1)
    expect(rollValue(5, 1, 650)).toBe(1)
  })

  it('takes a custom duration', () => {
    expect(rollValue(0, 4, 100, 100)).toBe(4)
  })
})

describe('celebrate event', () => {
  it('reaches listeners with the kind and the starting point', () => {
    const target = new EventTarget()
    const seen: CelebrateDetail[] = []
    const stop = onCelebrate(detail => seen.push(detail), target)
    celebrate({ kind: 'must_have', from: { x: 10, y: 20 } }, target)
    celebrate({ kind: 'bought' }, target)
    stop()
    celebrate({ kind: 'bought' }, target)
    expect(seen).toEqual([{ kind: 'must_have', from: { x: 10, y: 20 } }, { kind: 'bought' }])
  })
})
