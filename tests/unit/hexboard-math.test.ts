import { describe, expect, it } from 'vitest'

import {
  BOARD,
  PALETTE,
  boardFade,
  hexCorners,
  hexGrid,
  mix,
  nextPop,
  popGlow,
  waveHue,
  waveLight,
} from '../../src/app/hexboard-math.ts'

/** A fixed sequence of "random" numbers, repeated. */
function sequence(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('hexGrid', () => {
  it('lays out pointy-top hexagons with every other row shifted by half a cell', () => {
    const r = 10
    const cells = hexGrid(100, 60, r)
    const w = Math.sqrt(3) * r
    const row0 = cells.filter(c => c.row === 0)
    const row1 = cells.filter(c => c.row === 1)
    expect(row0[1].x - row0[0].x).toBeCloseTo(w)
    expect(row1[0].y - row0[0].y).toBeCloseTo(1.5 * r)
    expect(Math.abs(row1[0].x - row0[0].x) % w).toBeCloseTo(w / 2)
  })

  it('covers the whole area including the edges', () => {
    const cells = hexGrid(360, 740, 17)
    const xs = cells.map(c => c.x)
    const ys = cells.map(c => c.y)
    expect(Math.min(...xs)).toBeLessThanOrEqual(0)
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(360)
    expect(Math.min(...ys)).toBeLessThanOrEqual(0)
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(740)
  })

  it('returns no cells for an empty area', () => {
    expect(hexGrid(0, 0, 17)).toEqual([])
  })
})

describe('hexCorners', () => {
  it('gives six corners at the radius, pointy at the top', () => {
    const corners = hexCorners(50, 50, 10)
    expect(corners).toHaveLength(6)
    for (const [x, y] of corners) expect(Math.hypot(x - 50, y - 50)).toBeCloseTo(10)
    expect(Math.min(...corners.map(([, y]) => y))).toBeCloseTo(40)
  })
})

describe('boardFade', () => {
  it('is brightest at the top and fades towards the bottom without vanishing', () => {
    expect(boardFade(0, 740)).toBe(1)
    expect(boardFade(370, 740)).toBeLessThan(1)
    expect(boardFade(370, 740)).toBeGreaterThan(boardFade(700, 740))
    expect(boardFade(740, 740)).toBe(BOARD.minFade)
    expect(boardFade(5000, 740)).toBe(BOARD.minFade)
  })
})

describe('waves', () => {
  it('keeps light and hue between 0 and 1 everywhere and at all times', () => {
    for (let x = -40; x < 460; x += 23)
      for (let y = -40; y < 800; y += 31)
        for (const t of [0, 1300, 17000, 600000]) {
          const light = waveLight(x, y, t)
          const hue = waveHue(x, y, t)
          expect(light).toBeGreaterThanOrEqual(0)
          expect(light).toBeLessThanOrEqual(1)
          expect(hue).toBeGreaterThanOrEqual(0)
          expect(hue).toBeLessThanOrEqual(1)
        }
  })

  it('leaves most cells dark and lights some of them', () => {
    const lights = hexGrid(360, 740, 17).map(c => waveLight(c.x, c.y, 4000))
    const lit = lights.filter(l => l > 0).length
    expect(lit).toBeGreaterThan(0)
    expect(lit).toBeLessThan(lights.length / 2)
  })

  it('moves slowly: a cell changes only a little within one frame', () => {
    for (let x = 0; x < 360; x += 37)
      for (let y = 0; y < 740; y += 41) {
        expect(Math.abs(waveLight(x, y, 10000 + 33) - waveLight(x, y, 10000))).toBeLessThan(0.05)
      }
  })

  it('moves at all: the board looks different a few seconds later', () => {
    const cells = hexGrid(360, 740, 17)
    const now = cells.map(c => waveLight(c.x, c.y, 4000))
    const later = cells.map(c => waveLight(c.x, c.y, 9000))
    expect(now).not.toEqual(later)
  })
})

describe('mix', () => {
  it('blends two colours', () => {
    expect(mix([0, 0, 0], [200, 100, 50], 0)).toEqual([0, 0, 0])
    expect(mix([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25])
    expect(mix([0, 0, 0], [200, 100, 50], 1)).toEqual([200, 100, 50])
  })
})

describe('nextPop', () => {
  it('waits 0.5 to 1.2 seconds until the next pop', () => {
    expect(nextPop(1000, cellsAt([0, 0]), 740, () => 0).next).toBe(1500)
    expect(nextPop(1000, cellsAt([0, 0]), 740, () => 0.999999).next).toBeCloseTo(2200)
  })

  it('picks a cell with the injected random and colours it orange mostly, teal sometimes', () => {
    const cells = cellsAt([0, 10], [0, 20], [0, 30], [0, 40])
    const orange = nextPop(0, cells, 740, sequence(0.5, 0.1, 0))
    expect(orange.pop).toEqual({ cell: 2, colour: 'orange', born: 0 })
    const teal = nextPop(0, cells, 740, sequence(0.25, 0.9, 0))
    expect(teal.pop).toEqual({ cell: 1, colour: 'teal', born: 0 })
  })

  it('skips cells in the lower part of the screen so content stays readable', () => {
    const cells = cellsAt([0, 700])
    expect(nextPop(0, cells, 740, () => 0).pop).toBeUndefined()
  })

  it('does not pop on an empty board', () => {
    expect(nextPop(0, [], 740, () => 0.3).pop).toBeUndefined()
  })
})

describe('popGlow', () => {
  it('rises and fades back to nothing over its life', () => {
    expect(popGlow(0)).toBe(0)
    expect(popGlow(BOARD.popLife / 2)).toBeCloseTo(1)
    expect(popGlow(BOARD.popLife)).toBe(0)
    expect(popGlow(BOARD.popLife + 100)).toBe(0)
    expect(popGlow(-5)).toBe(0)
  })
})

describe('contrast', () => {
  // The brightest a pixel can get: the top of the gradient under the warm glow, with a fully lit
  // wave cell in pure orange and a popping orange cell on top, at full fade (the top of the
  // screen). Fills and outlines are different pixels, so both are checked.
  it('keeps body and secondary text at least 4.5:1 on the brightest part of the board', () => {
    const top = over(PALETTE.top, PALETTE.orange, BOARD.glowAlpha)
    const fill = over(over(top, PALETTE.orange, BOARD.waveFillAlpha), PALETTE.orange, BOARD.popFillAlpha)
    const outline = over(
      over(top, PALETTE.orange, BOARD.lineAlpha + BOARD.waveLineAlpha),
      PALETTE.orange,
      BOARD.popLineAlpha,
    )
    for (const pixel of [fill, outline]) {
      expect(contrast(hex('#ECEEFF'), pixel)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(hex('#9AA0C8'), pixel)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

function cellsAt(...points: [number, number][]) {
  return points.map(([x, y], i) => ({ x, y, row: i }))
}

type Rgb = readonly [number, number, number]

function over(base: Rgb, colour: Rgb, alpha: number): Rgb {
  return [0, 1, 2].map(i => base[i] + (colour[i] - base[i]) * alpha) as unknown as Rgb
}

function hex(value: string): Rgb {
  const n = parseInt(value.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance([r, g, b]: Rgb) {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
