import React, { useMemo } from "react";
import { random } from "remotion";
import { CanvasLayer, createOffscreen } from "./CanvasLayer";
import { black, mix } from "../color";
import { BAR_CENTRE_Y_FRACTION } from "../layout";
import type { FieldMode, Palette } from "../variants";

/**
 * The background: a field of small squares over a broad radial wash.
 *
 * It has to stay subordinate to the bar, so its opacity is capped per variant
 * and the brightest squares are rare. Everything about it is a pure function
 * of the frame: the drift follows a closed path that returns to its start at
 * frame 480, and every flicker runs on a whole number of cycles across those
 * 480 frames, so the field is pixel-identical at both ends of the loop.
 */

export const LOOP = 480;

type Square = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  /** Prebuilt "rgba(r, g, b, " so the per-frame cost is one concatenation. */
  prefix: string;
  brightPrefix: string;
  /** Whole cycles across the loop — that is what makes the loop close. */
  cycles: number;
  phase: number;
  flashCycles: number;
  flashPhase: number;
  flashes: boolean;
  /** Proximity dimming, so a flash near the bar cannot shout it down. */
  quiet: number;
};

const rgbPrefix = (hex: string): string => {
  const h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, `;
};

/** A coarse value-noise field, so the frame has clusters and empty regions. */
const makeDensity = (seed: string) => {
  const cols = 9;
  const rows = 6;
  const grid: number[] = [];
  for (let i = 0; i < cols * rows; i++) {
    grid.push(random(`${seed}:density:${i}`));
  }
  return (nx: number, ny: number): number => {
    const fx = Math.min(0.9999, Math.max(0, nx)) * (cols - 1);
    const fy = Math.min(0.9999, Math.max(0, ny)) * (rows - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const x1 = Math.min(cols - 1, x0 + 1);
    const y1 = Math.min(rows - 1, y0 + 1);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = grid[y0 * cols + x0] + (grid[y0 * cols + x1] - grid[y0 * cols + x0]) * sx;
    const b = grid[y1 * cols + x0] + (grid[y1 * cols + x1] - grid[y1 * cols + x0]) * sx;
    return a + (b - a) * sy;
  };
};

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const buildSquares = (
  width: number,
  height: number,
  mode: FieldMode,
  palette: Palette,
  count: number,
  seed: string,
): Square[] => {
  const density = makeDensity(seed);
  const base = rgbPrefix(palette.fieldSquare);
  const bright = rgbPrefix(palette.fieldBright);
  const unit = Math.round(width / 112); // ~34px at 4K
  const squares: Square[] = [];
  const margin = unit * 3;

  // The bar has to win. Squares fade out as they approach it, so the field
  // stays a texture rather than a competitor.
  const quietCx = width / 2;
  const quietCy = height * BAR_CENTRE_Y_FRACTION;
  const quietRx = width * 0.3;
  const quietRy = height * 0.17;

  const push = (x: number, y: number, index: number) => {
    const r = random(`${seed}:sq:${index}`);
    const isBright = random(`${seed}:hot:${index}`) < 0.1;
    const flashes = random(`${seed}:flash:${index}`) < 0.008;
    const dx = (x - quietCx) / quietRx;
    const dy = (y - quietCy) / quietRy;
    const quiet = 0.3 + 0.7 * smoothstep(0.55, 1.9, Math.sqrt(dx * dx + dy * dy));
    squares.push({
      x,
      y,
      // Squared so most squares are small and the large ones stay occasional.
      size: unit * (0.22 + r * r * 1.15),
      alpha: (0.06 + random(`${seed}:a:${index}`) * 0.26) * quiet,
      prefix: isBright ? bright : base,
      brightPrefix: bright,
      cycles: 1 + Math.floor(random(`${seed}:cyc:${index}`) * 6),
      phase: random(`${seed}:ph:${index}`),
      flashCycles: 4 + Math.floor(random(`${seed}:fc:${index}`) * 7),
      flashPhase: random(`${seed}:fp:${index}`),
      flashes,
      quiet,
    });
  };

  if (mode === "columns") {
    // Loose vertical columns at irregular spacing — never a grid.
    let x = -margin;
    let column = 0;
    let index = 0;
    while (x < width + margin) {
      // A handful of near-empty columns is what makes the rest read as
      // columns rather than as an even scatter.
      const sparse = random(`${seed}:cs:${column}`) < 0.18;
      const columnDensity =
        (0.28 + random(`${seed}:cd:${column}`) * 0.72) * (sparse ? 0.14 : 1);
      let y = -margin + random(`${seed}:cy:${column}`) * unit * 4;
      while (y < height + margin) {
        const local = Math.pow(density(x / width, y / height), 1.7);
        if (random(`${seed}:keep:${index}`) < columnDensity * (0.25 + local * 1.3)) {
          push(x + random(`${seed}:jx:${index}`) * unit * 0.5, y, index);
        }
        y += unit * (0.7 + random(`${seed}:step:${index}`) * 1.45);
        index++;
      }
      x += unit * (0.75 + random(`${seed}:cw:${column}`) * 1.1);
      column++;
    }
    return squares;
  }

  // Scatter and sparse: no column structure at all, just varied density.
  let index = 0;
  let placed = 0;
  const cap = count * 14;
  while (placed < count && index < cap) {
    const x = -margin + random(`${seed}:px:${index}`) * (width + margin * 2);
    const y = -margin + random(`${seed}:py:${index}`) * (height + margin * 2);
    const local = Math.pow(density(x / width, y / height), 1.7);
    if (random(`${seed}:pk:${index}`) < 0.14 + local * 1.05) {
      push(x, y, index);
      placed++;
    }
    index++;
  }
  return squares;
};

export const DataField: React.FC<{
  width: number;
  height: number;
  palette: Palette;
  mode: FieldMode;
  count: number;
  opacity: number;
  additive: boolean;
  washStrength: number;
  scanlines: boolean;
  frame: number;
  seed: string;
}> = ({
  width,
  height,
  palette,
  mode,
  count,
  opacity,
  additive,
  washStrength,
  scanlines,
  frame,
  seed,
}) => {
  // The ground and its radial wash never change — rasterise once, blit after.
  const ground = useMemo(() => {
    const canvas = createOffscreen(width, height);
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return canvas;
    }
    ctx.fillStyle = palette.bgDeep;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.42;
    const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.72);
    wash.addColorStop(0, mix(palette.bgWash, palette.bgDeep, 1 - washStrength));
    wash.addColorStop(
      0.34,
      mix(palette.bgWash, palette.bgDeep, 1 - washStrength * 0.58),
    );
    wash.addColorStop(1, palette.bgDeep);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    if (scanlines) {
      // 5px at the 1080p delivery size, so they still read once downscaled.
      const step = Math.max(2, Math.round((height / 1080) * 5));
      const thickness = Math.max(1, Math.round(step / 5));
      ctx.fillStyle = black(0.03);
      for (let y = 0; y < height; y += step) {
        ctx.fillRect(0, y, width, thickness);
      }
    }
    return canvas;
  }, [width, height, palette, scanlines, washStrength]);

  const squares = useMemo(
    () => buildSquares(width, height, mode, palette, count, seed),
    [width, height, mode, palette, count, seed],
  );

  return (
    <CanvasLayer
      x={0}
      y={0}
      width={width}
      height={height}
      draw={(ctx) => {
        ctx.drawImage(ground, 0, 0);

        // A closed drift path: both terms return to zero at frame 480.
        const t = frame / LOOP;
        const driftX = Math.sin(Math.PI * 2 * t) * (width * 0.006);
        const driftY = Math.sin(Math.PI * 4 * t) * (width * 0.0035);

        ctx.save();
        ctx.translate(driftX, driftY);
        ctx.globalCompositeOperation = additive ? "lighter" : "source-over";

        for (let i = 0; i < squares.length; i++) {
          const s = squares[i];
          const wobble =
            0.5 + 0.5 * Math.sin(Math.PI * 2 * (s.cycles * t + s.phase));
          const alpha = s.alpha * (0.4 + 0.6 * wobble) * opacity;
          ctx.fillStyle = s.prefix + alpha.toFixed(3) + ")";
          ctx.fillRect(s.x, s.y, s.size, s.size);

          if (s.flashes) {
            const p =
              0.5 + 0.5 * Math.sin(Math.PI * 2 * (s.flashCycles * t + s.flashPhase));
            const spike = Math.pow(p, 34);
            if (spike > 0.01) {
              ctx.fillStyle =
                s.brightPrefix + (spike * 0.8 * s.quiet * opacity).toFixed(3) + ")";
              ctx.fillRect(s.x, s.y, s.size, s.size);
            }
          }
        }
        ctx.restore();
      }}
    />
  );
};
