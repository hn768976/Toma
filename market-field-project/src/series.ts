import {
  CHART,
  CYCLE_LENGTH,
  DURATION_IN_FRAMES,
  POINTS_ACROSS,
  SCROLL_POINTS_PER_FRAME,
} from "./config";
import { hash1, hash1s, lerp, mod, smoothstep } from "./random";

/**
 * Periodic value noise: random values on a lattice whose node count divides
 * CYCLE_LENGTH, smoothstep-interpolated. Periodic in `i` with period
 * CYCLE_LENGTH, which is what makes the whole animation loop.
 */
const latticeNoise = (i: number, step: number, seed: number) => {
  const nodes = CYCLE_LENGTH / step;
  const p = i / step;
  const n0 = Math.floor(p);
  const t = smoothstep(p - n0);
  const a = hash1s(mod(n0, nodes), seed);
  const b = hash1s(mod(n0 + 1, nodes), seed);
  return lerp(a, b, t);
};

/**
 * Sparse sharp spikes. Sampling the neighbourhood keeps this a pure function
 * of `i` — no scanning, no state.
 */
const spikes = (i: number, seed: number) => {
  let v = 0;
  for (let j = i - 3; j <= i + 3; j++) {
    const k = mod(j, CYCLE_LENGTH);
    const r = hash1(k, seed);
    if (r > 0.955) {
      const magnitude = (r - 0.955) / 0.045; // 0..1
      const sign = hash1(k, seed ^ 0x9e37) > 0.42 ? 1 : -1;
      const falloff = 1 - Math.abs(i - j) / 4;
      v += sign * magnitude * falloff * falloff;
    }
  }
  return v;
};

/**
 * One series value in [-1, 1]-ish. Pure function of the data index and a
 * seed: no accumulation, safe to evaluate for any frame in any order.
 */
export const seriesNoise = (i: number, seed: number) => {
  // Slow "volatility regime": dips give the flat stretches, peaks give the
  // busy ones. Never zero, so the line always has some tick to it.
  const activity =
    0.22 + 0.78 * smoothstep((latticeNoise(i, 50, seed ^ 0x1111) + 1) / 2);

  const wander =
    0.62 * latticeNoise(i, 60, seed ^ 0x2222) +
    0.34 * latticeNoise(i, 30, seed ^ 0x3333);

  const detail =
    0.2 * latticeNoise(i, 12, seed ^ 0x4444) +
    0.13 * latticeNoise(i, 4, seed ^ 0x5555) +
    0.075 * hash1s(mod(i, CYCLE_LENGTH), seed ^ 0x6666);

  return wander + activity * (detail + 0.42 * spikes(i, seed ^ 0x7777));
};

/** Cosine-interpolated envelope across 5 control points spanning x = 0..1. */
export const envelopeAt = (controls: readonly number[], x: number) => {
  const span = controls.length - 1;
  const p = Math.min(Math.max(x, 0), 1) * span;
  const i = Math.min(Math.floor(p), span - 1);
  return lerp(controls[i], controls[i + 1], smoothstep(p - i));
};

export type SeriesPoint = { x: number; y: number };

export type SeriesGeometry = {
  points: SeriesPoint[];
  linePath: string;
  areaPath: string;
};

/**
 * Builds the visible window of a series for one frame, in composition pixels.
 *
 * The window is a whole number of points wide plus a couple of points of
 * overhang on each side, so the polyline always leaves the frame rather than
 * ending inside it.
 */
export const buildSeries = ({
  frame,
  width,
  height,
  seed,
  envelope,
}: {
  frame: number;
  width: number;
  height: number;
  seed: number;
  envelope: readonly number[];
}): SeriesGeometry => {
  const spacing = width / POINTS_ACROSS;
  const offset = mod(frame, DURATION_IN_FRAMES) * SCROLL_POINTS_PER_FRAME;
  const first = Math.floor(offset) - 2;
  const last = first + POINTS_ACROSS + 5;
  const amplitude = CHART.amplitude * height;

  const points: SeriesPoint[] = [];
  for (let i = first; i <= last; i++) {
    const x = (i - offset) * spacing;
    const base = envelopeAt(envelope, x / width) * height;
    points.push({ x, y: base + amplitude * seriesNoise(i, seed) });
  }

  let linePath = "";
  for (let n = 0; n < points.length; n++) {
    const { x, y } = points[n];
    linePath += `${n === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }

  const baseline = height * (1 + CHART.baselineOverdraw);
  const areaPath =
    linePath +
    `L${points[points.length - 1].x.toFixed(2)} ${baseline}` +
    `L${points[0].x.toFixed(2)} ${baseline}Z`;

  return { points, linePath, areaPath };
};
