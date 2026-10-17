/**
 * Pure maths for the hexagon board behind every screen (docs/design.md §9 "Background"):
 * the honeycomb layout, the slow light waves, and when and where a single cell pops.
 * Times are in milliseconds, like requestAnimationFrame timestamps.
 */

export type Rgb = readonly [number, number, number];

export const PALETTE = {
  /** The deep blue-violet gradient, top to bottom. */
  top: [25, 26, 61],
  middle: [15, 17, 38],
  bottom: [11, 12, 28],
  violet: [139, 92, 246],
  orange: [255, 122, 26],
  teal: [20, 200, 200],
} as const satisfies Record<string, Rgb>;

/** Sizes, opacities and timings. The alphas are kept low so text on top keeps ≥ 4.5:1. */
export const BOARD = {
  radius: 17,
  /** Gap between neighbouring cells, in px. */
  gap: 1.6,
  /** Lowest brightness at the bottom of the screen. */
  minFade: 0.18,
  /** Outline of every cell; lit cells add `waveLineAlpha`. */
  lineAlpha: 0.035,
  waveLineAlpha: 0.06,
  waveFillAlpha: 0.08,
  /** Warm glow in the top corner. */
  glowAlpha: 0.06,
  popFillAlpha: 0.1,
  popLineAlpha: 0.1,
  popLife: 2600,
  popGapMin: 500,
  popGapMax: 1200,
  /** Pops only happen in the upper part of the screen. */
  popZone: 0.7,
  /** Share of pops that are orange; the rest are teal. */
  orangeShare: 0.75,
  /** ~30 fps. */
  frameMs: 33,
};

export interface HexCell {
  x: number;
  y: number;
  row: number;
}

/** Centres of pointy-top hexagons covering width × height, one cell beyond every edge. */
export function hexGrid(
  width: number,
  height: number,
  radius: number,
): HexCell[] {
  if (width <= 0 || height <= 0) return [];
  const dx = Math.sqrt(3) * radius;
  const dy = 1.5 * radius;
  const cells: HexCell[] = [];
  for (let row = 0, y = -radius; y < height + radius + dy; row++, y += dy) {
    const shift = row % 2 ? dx / 2 : 0;
    for (let x = shift - dx; x < width + dx; x += dx) cells.push({ x, y, row });
  }
  return cells;
}

/** The six corners of a pointy-top hexagon. */
export function hexCorners(
  x: number,
  y: number,
  radius: number,
): [number, number][] {
  return Array.from({ length: 6 }, (_, k) => {
    const angle = Math.PI / 6 + (k * Math.PI) / 3;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  });
}

/** Brightness factor by height: 1 at the top, fading to `minFade` near the bottom. */
export function boardFade(y: number, height: number): number {
  return Math.min(1, Math.max(BOARD.minFade, 1 - y / (height * 0.85)));
}

/** How strongly the light waves fill a cell (0 = dark, 1 = fully lit). */
export function waveLight(x: number, y: number, t: number): number {
  const s = t / 1000;
  const wave =
    Math.sin(x * 0.017 + s * 0.5) * Math.cos(y * 0.013 - s * 0.38) +
    0.5 * Math.sin((x + y) * 0.009 - s * 0.65);
  return Math.min(1, Math.max(0, (wave - 0.6) / 0.9));
}

/** Where a lit cell sits between violet (0) and orange (1). */
export function waveHue(x: number, y: number, t: number): number {
  return (Math.sin(x * 0.011 + y * 0.007 + (t / 1000) * 0.22) + 1) / 2;
}

export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const at = (i: 0 | 1 | 2) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return [at(0), at(1), at(2)];
}

export interface Pop {
  /** Index into the cells. */
  cell: number;
  colour: "orange" | "teal";
  born: number;
}

/** Picks the next cell to pop (none in the lower part of the screen) and when to pick again. */
export function nextPop(
  now: number,
  cells: readonly HexCell[],
  height: number,
  random: () => number,
): { pop?: Pop; next: number } {
  let pop: Pop | undefined;
  if (cells.length > 0) {
    const cell = Math.min(
      cells.length - 1,
      Math.floor(random() * cells.length),
    );
    const colour = random() < BOARD.orangeShare ? "orange" : "teal";
    if ((cells[cell]?.y ?? height) < height * BOARD.popZone)
      pop = { cell, colour, born: now };
  }
  return {
    pop,
    next:
      now + BOARD.popGapMin + random() * (BOARD.popGapMax - BOARD.popGapMin),
  };
}

/** A popping cell's strength by age: rises, then fades back to 0 at the end of its life. */
export function popGlow(age: number): number {
  if (age <= 0 || age >= BOARD.popLife) return 0;
  return Math.sin((Math.PI * age) / BOARD.popLife);
}
