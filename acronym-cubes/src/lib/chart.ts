// The printed chart: price line and volume bars, per acronym.
// Pure functions of the data row (no DOM), so they can be checked in Node.
//
// Everything is laid out in FRAME fractions (fx across, fy down) like the
// reference clip, then projected onto the paper through the camera
// (screen.ts). The line spans the same band of the frame as the reference
// (about 14%-87% of frame height) and is drawn as price ticks: a few hundred
// vertices across the frame, jagged but coherent.

import type { AcronymRow, ChartShape } from "../data/acronyms";
import { REFERENCE_LINE } from "../data/referenceLine";
import { gauss, range, seeded, type Rng } from "./prng";
import { screenToPaper } from "./screen";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// Frame band the line may use (fractions of frame height), as in the reference.
const BAND_TOP = 0.14;
const BAND_BOTTOM = 0.87;
const ROW_FY = 0.52; // the cube row; lines pass under / around it

type ShapeSpec = {
  base: (t: number) => number; // 0..1 "price" across the frame (t = fx)
  wander: number; // mid-scale wander, fraction of the band
  tick: number; // tick-to-tick jaggedness, fraction of frame height
  span: number; // fraction of the band the line may use
};

// Stairs with seeded step positions, used by KPI (rising) and APR (rates).
const stairs = (rng: Rng, n: number, ramp: number, allowDown: boolean) => {
  const xs: number[] = [];
  const ys: number[] = [];
  let y = 0;
  for (let i = 0; i < n; i++) {
    xs.push((i + 0.25 + 0.5 * rng()) / n);
    const down = rng() < 0.15 && allowDown;
    y += (0.6 + 0.8 * rng()) * (down ? -0.6 : 1);
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

const SHAPES: Record<Exclude<ChartShape, "reference">, (rng: Rng) => ShapeSpec> = {
  steadyRise: () => ({ base: (t) => t, wander: 0.09, tick: 0.0045, span: 0.8 }),
  listingPop: () => ({
    base: (t) => 0.08 * t + 0.85 * smooth(0.6, 0.635, t) - 0.05 * smooth(0.7, 1, t),
    wander: 0.05,
    tick: 0.0035,
    span: 0.92,
  }),
  clearRise: () => ({ base: (t) => Math.pow(t, 1.15), wander: 0.09, tick: 0.0045, span: 0.95 }),
  dipRecovery: () => ({
    base: (t) =>
      0.55 * smooth(0, 0.22, t) - 0.75 * smooth(0.24, 0.5, t) + 1.0 * smooth(0.5, 0.8, t),
    wander: 0.1,
    tick: 0.0045,
    span: 0.95,
  }),
  steadyClimb: () => ({ base: (t) => t, wander: 0.035, tick: 0.002, span: 0.82 }),
  steppedRise: (rng) => {
    const s = stairs(rng, 5, 0.012, false);
    return { base: (t) => s(t), wander: 0.03, tick: 0.0025, span: 0.88 };
  },
  longGentleRise: () => ({
    base: (t) => 0.45 * t + 0.55 * ((Math.exp(1.6 * t) - 1) / (Math.exp(1.6) - 1)),
    wander: 0.06,
    tick: 0.003,
    span: 0.62,
  }),
  gentleRise: () => ({ base: (t) => t, wander: 0.05, tick: 0.003, span: 0.5 }),
  rateSteps: (rng) => {
    const s = stairs(rng, 6, 0.003, true);
    return { base: (t) => s(t), wander: 0, tick: 0.0006, span: 0.62 };
  },
  flatSideways: () => ({ base: () => 0.5, wander: 0.35, tick: 0.0035, span: 0.2 }),
  rising: () => ({ base: (t) => t, wander: 0.09, tick: 0.0045, span: 0.85 }),
};

// The line covers a little more than the frame so it runs off the sheet edges.
const FX0 = -0.09;
const FX1 = 1.09;
export const CHART_POINTS = 1100; // ~930 vertices across the visible frame

// Tick noise: a random walk minus its own moving average, i.e. jagged
// price-like detail that never bends the overall shape.
const tickNoise = (rng: Rng, n: number, window: number) => {
  const w: number[] = [0];
  for (let i = 1; i < n; i++) w.push(w[i - 1] + gauss(rng) * (rng() < 0.05 ? 2.6 : 1));
  const out: number[] = [];
  let maxAbs = 1e-9;
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let k = Math.max(0, i - window); k <= Math.min(n - 1, i + window); k++) {
      s += w[k];
      c++;
    }
    out.push(w[i] - s / c);
    maxAbs = Math.max(maxAbs, Math.abs(out[i]));
  }
  return out.map((v) => v / maxAbs);
};

// Brownian bridge scaled to +-1 (mid-scale wander).
const bridge = (rng: Rng, n: number) => {
  const w: number[] = [0];
  for (let i = 1; i < n; i++) w.push(w[i - 1] + gauss(rng));
  const end = w[n - 1];
  let maxAbs = 1e-9;
  for (let i = 0; i < n; i++) {
    w[i] -= (end * i) / (n - 1);
    maxAbs = Math.max(maxAbs, Math.abs(w[i]));
  }
  return w.map((v) => v / maxAbs);
};

const referenceFy = (fx: number) => {
  const n = REFERENCE_LINE.length;
  const x = Math.min(Math.max(fx, 0), 1) * (n - 1);
  const i = Math.min(Math.floor(x), n - 2);
  const f = x - i;
  return REFERENCE_LINE[i] * (1 - f) + REFERENCE_LINE[i + 1] * f;
};

// Price line in frame fractions: [fx, fy] pairs.
export const priceLineScreen = (row: AcronymRow): [number, number][] => {
  const rng = seeded(row.id, row.seed, "chart");
  const n = CHART_POINTS;
  const fxs = Array.from({ length: n }, (_, i) => FX0 + ((FX1 - FX0) * i) / (n - 1));

  if (row.shape === "reference") {
    // The traced reference line, plus fine ticks for 4K, and a seeded walk
    // carrying it past the frame edges.
    const ticks = tickNoise(rng, n, 4);
    const edgeWalk = bridge(rng, n);
    return fxs.map((fx, i) => {
      const outside = fx < 0 ? -fx : fx > 1 ? fx - 1 : 0;
      const fy = referenceFy(fx) + 0.35 * outside * edgeWalk[i] + 0.0035 * ticks[i];
      return [fx, fy];
    });
  }

  const spec = SHAPES[row.shape](rng);
  const wander = bridge(rng, n);
  const ticks = tickNoise(rng, n, 6);
  const v = fxs.map((fx, i) => spec.base(Math.min(Math.max(fx, 0), 1)) + spec.wander * wander[i]);
  // Scale into the band so the line sits under the cube row at fx = 0.5.
  const mid = v[Math.round((0.5 - FX0) / (FX1 - FX0) * (n - 1))];
  let up = 1e-9;
  let down = 1e-9;
  v.forEach((x, i) => {
    if (fxs[i] < 0 || fxs[i] > 1) return;
    up = Math.max(up, x - mid);
    down = Math.max(down, mid - x);
  });
  const band = BAND_BOTTOM - BAND_TOP;
  const scale = Math.min(
    (ROW_FY - BAND_TOP) / up,
    (BAND_BOTTOM - ROW_FY) / down,
    (spec.span * band) / (up + down),
  );
  return fxs.map((fx, i) => [fx, ROW_FY - (v[i] - mid) * scale + spec.tick * ticks[i]]);
};

export const priceLine = (row: AcronymRow): [number, number][] =>
  priceLineScreen(row).map(([fx, fy]) => screenToPaper(fx, fy));

// Volume bars, reference style: clusters every ~23.5% of the frame width,
// each a dense run of short bars with a few tall spikes at its edges, all
// standing on a baseline near the bottom of the frame. Returned in world
// units: x, z of the base and z of the top.
export const VOLUME_BASE_FY = 0.965;

export const volumeBarsScreen = (row: AcronymRow): { fx: number; h: number }[] => {
  const rng = seeded(row.id, row.seed, "volume");
  const bars: { fx: number; h: number }[] = [];
  const start = row.shape === "reference" ? 0.035 : range(rng, 0.0, 0.08);
  const pitch = row.shape === "reference" ? 0.235 : range(rng, 0.21, 0.26);
  for (let c = start - pitch; c < 1.1; c += pitch) {
    const width = range(rng, 0.085, 0.1);
    const left = c + range(rng, -0.01, 0.01);
    for (let fx = left; fx < left + width; fx += 0.0034) {
      if (rng() < 0.06) continue;
      bars.push({ fx, h: 0.006 + 0.03 * Math.pow(rng(), 2.4) });
    }
    // Tall spikes: the right edge is usually the tallest, as in the reference.
    bars.push({ fx: left, h: range(rng, 0.06, 0.13) });
    if (rng() < 0.7) bars.push({ fx: left + range(rng, 0.02, 0.05), h: range(rng, 0.05, 0.11) });
    bars.push({ fx: left + width, h: range(rng, 0.12, 0.27) });
  }
  return bars;
};

export const volumeBars = (row: AcronymRow) =>
  volumeBarsScreen(row).map(({ fx, h }) => {
    const [x, zBase] = screenToPaper(fx, VOLUME_BASE_FY);
    const [, zTop] = screenToPaper(fx, VOLUME_BASE_FY - h);
    return { x, zBase, zTop };
  });
