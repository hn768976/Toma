// The printed chart: price line and volume bars, per acronym.
// Pure functions of the data row (no DOM), so they can be checked in Node.

import type { AcronymRow, ChartShape } from "../data/acronyms";
import { gauss, seeded, type Rng } from "./prng";
import {
  CHART_BOTTOM_Z,
  CHART_CENTRE_Z,
  CHART_TOP_Z,
  PAPER_W,
  VOLUME_MAX_H,
} from "./world";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

type ShapeSpec = {
  base: (t: number, rng: Rng) => number; // 0..1 "price", t = 0..1 across the sheet
  walk: number; // amplitude of the seeded random walk
  jitter: number; // amplitude of tick-to-tick noise
  span: number; // fraction of the chart band the line may use
};

// Stairs with seeded step positions, used by KPI (rising) and APR (rates).
const stairs = (rng: Rng, n: number, up: number, ramp: number, allowDown: boolean) => {
  const xs: number[] = [];
  const ys: number[] = [];
  let y = 0;
  for (let i = 0; i < n; i++) {
    xs.push((i + 0.25 + 0.5 * rng()) / n);
    const down = rng() < 0.15 && allowDown;
    y += up * (0.6 + 0.8 * rng()) * (down ? -0.6 : 1);
    ys.push(y);
  }
  return (t: number) => {
    let v = 0;
    let prev = 0;
    for (let i = 0; i < n; i++) {
      v += (ys[i] - prev) * smooth(xs[i] - ramp, xs[i] + ramp, t);
      prev = ys[i];
    }
    return v;
  };
};

const SHAPES: Record<ChartShape, (rng: Rng) => ShapeSpec> = {
  steadyRise: () => ({ base: (t) => t, walk: 0.07, jitter: 0.012, span: 0.8 }),
  listingPop: () => ({
    base: (t) => 0.08 * t + 0.85 * smooth(0.6, 0.635, t) - 0.05 * smooth(0.7, 1, t),
    walk: 0.035,
    jitter: 0.008,
    span: 0.92,
  }),
  clearRise: () => ({ base: (t) => Math.pow(t, 1.15), walk: 0.06, jitter: 0.012, span: 0.95 }),
  dipRecovery: () => ({
    base: (t) =>
      0.55 * smooth(0, 0.22, t) - 0.75 * smooth(0.24, 0.5, t) + 1.0 * smooth(0.5, 0.8, t),
    walk: 0.11,
    jitter: 0.014,
    span: 0.95,
  }),
  steadyClimb: () => ({ base: (t) => t, walk: 0.022, jitter: 0.005, span: 0.82 }),
  steppedRise: (rng) => {
    const s = stairs(rng, 5, 1, 0.012, false);
    return { base: (t) => s(t), walk: 0.025, jitter: 0.006, span: 0.88 };
  },
  longGentleRise: () => ({
    base: (t) => 0.45 * t + 0.55 * ((Math.exp(1.6 * t) - 1) / (Math.exp(1.6) - 1)),
    walk: 0.045,
    jitter: 0.008,
    span: 0.6,
  }),
  gentleRise: () => ({ base: (t) => t, walk: 0.035, jitter: 0.007, span: 0.5 }),
  rateSteps: (rng) => {
    const s = stairs(rng, 6, 1, 0.003, true);
    return { base: (t) => s(t), walk: 0.0, jitter: 0.0015, span: 0.62 };
  },
  flatSideways: () => ({ base: () => 0.5, walk: 0.05, jitter: 0.0035, span: 0.2 }),
  rising: () => ({ base: (t) => t, walk: 0.065, jitter: 0.013, span: 0.85 }),
};

export const CHART_POINTS = 1700;

// Returns the price line as world (x, z) points across the full sheet.
export const priceLine = (row: AcronymRow): [number, number][] => {
  const rng = seeded(row.id, row.seed, "chart");
  const spec = SHAPES[row.shape](rng);
  const n = CHART_POINTS;

  // Seeded random walk with occasional bigger moves, turned into a bridge
  // (starts and ends at 0) so it wiggles around the shape without bending it.
  const walk: number[] = [0];
  for (let i = 1; i < n; i++) {
    const shock = rng() < 0.04 ? 3.2 : 1;
    walk.push(walk[i - 1] + gauss(rng) * shock);
  }
  const end = walk[n - 1];
  let maxAbs = 1e-9;
  for (let i = 0; i < n; i++) {
    walk[i] -= (end * i) / (n - 1);
    maxAbs = Math.max(maxAbs, Math.abs(walk[i]));
  }

  const v: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    v.push(spec.base(t, rng) + (spec.walk * walk[i]) / maxAbs + spec.jitter * gauss(rng));
  }

  // Scale into the chart band so the line passes under the cube row
  // (t = 0.5 sits on CHART_CENTRE_Z) and never leaves the band.
  const mid = v[Math.floor((n - 1) / 2)];
  let above = 1e-9; // how far the line goes up from mid (in v units)
  let below = 1e-9;
  for (const x of v) {
    above = Math.max(above, x - mid);
    below = Math.max(below, mid - x);
  }
  const roomUp = CHART_CENTRE_Z - CHART_TOP_Z;
  const roomDown = CHART_BOTTOM_Z - CHART_CENTRE_Z;
  const band = CHART_BOTTOM_Z - CHART_TOP_Z;
  const scale = Math.min(roomUp / above, roomDown / below, (spec.span * band) / (above + below));

  return v.map((x, i) => [
    -PAPER_W / 2 + (PAPER_W * i) / (n - 1),
    CHART_CENTRE_Z - (x - mid) * scale,
  ]);
};

// Volume bars: thin bars in irregular clusters along the bottom of the sheet.
export const volumeBars = (row: AcronymRow): { x: number; h: number }[] => {
  const rng = seeded(row.id, row.seed, "volume");
  const bars: { x: number; h: number }[] = [];
  // Clusters of activity at seeded positions.
  const clusters = Array.from({ length: 9 }, () => ({
    c: -PAPER_W / 2 + PAPER_W * rng(),
    w: 0.25 + 0.9 * rng(),
    k: 0.4 + 0.6 * rng(),
  }));
  const step = 0.034;
  for (let x = -PAPER_W / 2; x <= PAPER_W / 2; x += step) {
    let act = 0.05;
    for (const cl of clusters) act += cl.k * Math.exp(-(((x - cl.c) / cl.w) ** 2));
    if (rng() > Math.min(act, 0.95)) continue;
    const spike = rng() < 0.03 ? 2.4 + 2.2 * rng() : 1;
    const h = Math.min(VOLUME_MAX_H, (0.07 + 0.3 * rng() * Math.min(act, 1.2)) * spike);
    bars.push({ x, h });
  }
  return bars;
};
