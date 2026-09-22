import { mulberry32, range } from "../lib/random";
import type { Pt } from "../lib/geom";
import { DESIGN_W, DESIGN_H } from "../lib/layout";

/**
 * Staircase geometry for look 1. Built once at module level from a seeded
 * PRNG — the shape is fixed for the whole render, only how much of it is drawn
 * changes with the frame.
 */
export const staircase = (opts: {
  seed: number;
  steps: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** >1 accelerates the rise toward the right */
  curve?: number;
  /** fraction of each step spent rising rather than running flat */
  riseFrac?: number;
  jitter?: number;
}): Pt[] => {
  const {
    seed,
    steps,
    x0,
    x1,
    y0,
    y1,
    curve = 1.18,
    riseFrac = 0.55,
    jitter = 0.14,
  } = opts;
  const rnd = mulberry32(seed);
  const level = (k: number) => {
    const p = k / steps;
    const shaped = Math.pow(p, curve);
    return y0 + (y1 - y0) * shaped;
  };
  const xs: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const base = x0 + ((x1 - x0) * k) / steps;
    const j = k === 0 || k === steps ? 0 : range(rnd, -jitter, jitter) * ((x1 - x0) / steps);
    xs.push(base + j);
  }
  const pts: Pt[] = [{ x: xs[0], y: level(0) }];
  for (let k = 0; k < steps; k++) {
    const segW = xs[k + 1] - xs[k];
    const rf = riseFrac * (0.8 + rnd() * 0.4);
    const riseX = xs[k] + segW * rf;
    pts.push({ x: riseX, y: level(k + 1) });
    pts.push({ x: xs[k + 1], y: level(k + 1) });
  }
  return pts;
};

/** y of the staircase at a given x (the polyline is monotone in x). */
export const yAtX = (pts: readonly Pt[], x: number) => {
  if (x <= pts[0].x) return pts[0].y;
  const last = pts[pts.length - 1];
  if (x >= last.x) return last.y;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x >= x) {
      const a = pts[i - 1];
      const b = pts[i];
      const f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * f;
    }
  }
  return last.y;
};

/* ------------------------------------------------------------------ 1A */

export const NAVY_MAIN = staircase({
  seed: 20240101,
  steps: 9,
  x0: 0.3 * DESIGN_W,
  x1: 0.875 * DESIGN_W,
  y0: 0.875 * DESIGN_H,
  y1: 0.165 * DESIGN_H,
  curve: 1.2,
  riseFrac: 0.56,
});

/** The fainter companion line that runs above the hero line on the right. */
export const NAVY_SECOND = staircase({
  seed: 77120033,
  steps: 7,
  x0: 0.335 * DESIGN_W,
  x1: 0.9 * DESIGN_W,
  y0: 0.79 * DESIGN_H,
  y1: 0.105 * DESIGN_H,
  curve: 1.35,
  riseFrac: 0.78,
  jitter: 0.2,
});

export type SpeckArrow = {
  x: number;
  topY: number;
  len: number;
  headW: number;
  shaftW: number;
  specks: { dx: number; dy: number; r: number; v: number; off: number; a: number }[];
};

export const buildArrows = (line: Pt[], count: number, seed: number): SpeckArrow[] => {
  const rnd = mulberry32(seed);
  const xStart = line[0].x + 0.012 * DESIGN_W;
  const xEnd = line[line.length - 1].x - 0.012 * DESIGN_W;
  const out: SpeckArrow[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const x = xStart + (xEnd - xStart) * t + range(rnd, -8, 8);
    const lineY = yAtX(line, x);
    const topY = lineY + range(rnd, 34, 74);
    // Arrows get taller toward the right, echoing the growth they sit under.
    const len = (0.155 + 0.185 * t) * DESIGN_H * range(rnd, 0.88, 1.12);
    const headW = (0.0235 + 0.0115 * t) * DESIGN_W;
    const shaftW = headW * range(rnd, 0.26, 0.33);
    const specks: SpeckArrow["specks"] = [];
    const speckCount = 60;
    for (let s = 0; s < speckCount; s++) {
      const u = rnd();
      // Density rises toward the base: the arrow dissolves downward.
      const dy = (0.3 + 0.75 * Math.pow(u, 0.55)) * len;
      const spread = headW * (0.22 + 1.05 * Math.pow(dy / len, 1.7));
      specks.push({
        dx: range(rnd, -spread, spread),
        dy,
        r: range(rnd, 3.2, 9.5),
        v: range(rnd, 0.0045, 0.013),
        off: rnd(),
        a: range(rnd, 0.35, 1),
      });
    }
    out.push({ x, topY, len, headW, shaftW, specks });
  }
  return out;
};

export const NAVY_ARROWS = buildArrows(NAVY_MAIN, 16, 5150111);

/* ------------------------------------------------------------------ 1B */

/**
 * 1B is a close crop: the hero line runs off the left edge and stops
 * mid-frame, exactly as in the reference.
 */
export const BLACK_MAIN = staircase({
  seed: 31415926,
  steps: 7,
  x0: -0.09 * DESIGN_W,
  x1: 0.63 * DESIGN_W,
  y0: 1.02 * DESIGN_H,
  y1: 0.27 * DESIGN_H,
  curve: 1.0,
  riseFrac: 0.5,
  jitter: 0.18,
});

/**
 * Jagged darker line sitting behind the hero line. Deliberately NOT another
 * staircase — in the reference this is a spiky trace with real peaks and
 * troughs, which is what stops it reading as a duplicate of the hero.
 */
export const BLACK_BEHIND = ((): Pt[] => {
  const rnd = mulberry32(2718281);
  const n = 26;
  const x0 = -0.06 * DESIGN_W;
  const x1 = 0.66 * DESIGN_W;
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const trend = 1.02 * DESIGN_H + (0.16 * DESIGN_H - 1.02 * DESIGN_H) * Math.pow(t, 1.05);
    const spike = (i % 2 === 0 ? -1 : 1) * range(rnd, 0.006, 0.038) * DESIGN_H;
    pts.push({ x: x0 + (x1 - x0) * t + range(rnd, -14, 14), y: trend + spike });
  }
  return pts;
})();
