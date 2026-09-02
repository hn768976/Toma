import { clamp } from "./rand";

/**
 * Weighted angular sampling for radial fields.
 *
 * Sampling angles uniformly produces an even sunburst, which reads as
 * clip art. `buildAngularCdf` turns an arbitrary weight function of the
 * angle into an inverse-CDF table, so a caller can draw angles that are
 * dense in one direction and sparse in another while still being
 * deterministic and evenly jittered within each band.
 */

export type AngularCdf = {
  /** Cumulative weights, length `bins + 1`, normalised to end at 1. */
  cdf: Float64Array;
  from: number;
  to: number;
  bins: number;
};

export const buildAngularCdf = (
  weight: (angle: number) => number,
  options?: { from?: number; to?: number; bins?: number },
): AngularCdf => {
  const from = options?.from ?? -Math.PI;
  const to = options?.to ?? Math.PI;
  const bins = options?.bins ?? 720;
  const cdf = new Float64Array(bins + 1);
  let acc = 0;
  for (let i = 0; i < bins; i++) {
    const a = from + ((i + 0.5) / bins) * (to - from);
    acc += Math.max(0, weight(a));
    cdf[i + 1] = acc;
  }
  if (acc <= 0) {
    for (let i = 0; i <= bins; i++) cdf[i] = i / bins;
    return { cdf, from, to, bins };
  }
  for (let i = 0; i <= bins; i++) cdf[i] /= acc;
  return { cdf, from, to, bins };
};

/** Maps a uniform `u` in [0, 1) to an angle distributed by the CDF. */
export const sampleAngle = (table: AngularCdf, u: number): number => {
  const { cdf, from, to, bins } = table;
  const target = clamp(u, 0, 0.999999);
  let lo = 0;
  let hi = bins;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cdf[mid + 1] <= target) lo = mid + 1;
    else hi = mid;
  }
  const span = cdf[lo + 1] - cdf[lo];
  const frac = span > 0 ? (target - cdf[lo]) / span : 0.5;
  return from + ((lo + frac) / bins) * (to - from);
};

/**
 * Distance from a point to the edge of a `w` x `h` rectangle along a
 * given angle. Used to give every ray of a radial field the exact reach
 * it needs to leave frame, instead of an over-generous constant.
 */
export const distanceToEdge = (
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
): number => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = Infinity;
  if (dx > 1e-9) best = Math.min(best, (w - x) / dx);
  if (dx < -1e-9) best = Math.min(best, -x / dx);
  if (dy > 1e-9) best = Math.min(best, (h - y) / dy);
  if (dy < -1e-9) best = Math.min(best, -y / dy);
  return Number.isFinite(best) ? best : Math.max(w, h);
};
