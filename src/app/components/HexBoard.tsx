import { useEffect, useRef } from "react";

import {
  BOARD,
  type HexCell,
  PALETTE,
  type Pop,
  type Rgb,
  boardFade,
  hexCorners,
  hexGrid,
  mix,
  nextPop,
  popGlow,
  waveHue,
  waveLight,
} from "../hexboard-math.ts";

/** The moment drawn as the single still frame with reduced motion: some waves are lit. */
const STILL_AT = 4000;

const rgba = ([r, g, b]: Rgb, alpha: number) =>
  `rgba(${r},${g},${b},${alpha.toFixed(3)})`;

/**
 * The living hexagon board behind the phone column (docs/design.md §2 and §9): decoration only,
 * hidden from assistive technology and never in the way of a tap.
 */
export function HexBoard() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let cells: HexCell[] = [];
    let pops: Pop[] = [];
    let popAt = 0;
    let last = -Infinity;
    let frame = 0;

    const trace = (x: number, y: number, radius: number) => {
      ctx.beginPath();
      for (const [px, py] of hexCorners(x, y, radius)) ctx.lineTo(px, py);
      ctx.closePath();
    };

    const draw = (t: number, animate: boolean) => {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, rgba(PALETTE.top, 1));
      sky.addColorStop(0.45, rgba(PALETTE.middle, 1));
      sky.addColorStop(1, rgba(PALETTE.bottom, 1));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(
        width * 0.95,
        0,
        0,
        width * 0.95,
        0,
        width * 0.9,
      );
      glow.addColorStop(0, rgba(PALETTE.orange, BOARD.glowAlpha));
      glow.addColorStop(1, rgba(PALETTE.orange, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      const inner = BOARD.radius - BOARD.gap;
      for (const cell of cells) {
        const fade = boardFade(cell.y, height);
        const light = waveLight(cell.x, cell.y, t);
        trace(cell.x, cell.y, inner);
        if (light > 0) {
          const colour = mix(
            PALETTE.violet,
            PALETTE.orange,
            waveHue(cell.x, cell.y, t),
          );
          ctx.fillStyle = rgba(colour, light * BOARD.waveFillAlpha * fade);
          ctx.fill();
        }
        ctx.strokeStyle = rgba(
          PALETTE.violet,
          (BOARD.lineAlpha + light * BOARD.waveLineAlpha) * fade,
        );
        ctx.stroke();
      }

      if (!animate) return;
      if (t >= popAt) {
        const { pop, next } = nextPop(t, cells, height, Math.random);
        if (pop) pops.push(pop);
        popAt = next;
      }
      pops = pops.filter((pop) => t - pop.born < BOARD.popLife);
      for (const pop of pops) {
        const cell = cells[pop.cell];
        if (!cell) continue;
        const glow = popGlow(t - pop.born);
        const fade = boardFade(cell.y, height);
        const colour = PALETTE[pop.colour];
        trace(cell.x, cell.y, inner * (0.75 + 0.25 * glow));
        ctx.fillStyle = rgba(colour, BOARD.popFillAlpha * glow * fade);
        ctx.fill();
        ctx.strokeStyle = rgba(colour, BOARD.popLineAlpha * glow * fade);
        ctx.stroke();
      }
    };

    const loop = (t: number) => {
      frame = requestAnimationFrame(loop);
      if (t - last < BOARD.frameMs) return;
      last = t;
      draw(t, true);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    // Reduced motion: one still frame and nothing more; hidden tab: nothing at all
    const start = () => {
      stop();
      if (reduced.matches) draw(STILL_AT, false);
      else if (!document.hidden) frame = requestAnimationFrame(loop);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = hexGrid(width, height, BOARD.radius);
      pops = [];
      if (reduced.matches) draw(STILL_AT, false);
      else draw(performance.now(), false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    start();
    reduced.addEventListener("change", start);
    document.addEventListener("visibilitychange", start);
    return () => {
      stop();
      observer.disconnect();
      reduced.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return <canvas ref={ref} className="hexboard" aria-hidden="true" />;
}
