/**
 * The angular distribution of the field.
 *
 * An even spread of angles reads as a sunburst. A city rushing past has dense
 * fans and sparse sectors, so streak angles are drawn from a lumpy density
 * built from a few seeded harmonics, inverted through its CDF. The lumpiness
 * is a per-variant dial: near zero for "mono", which is deliberately closer to
 * a uniform starfield.
 */

import { random } from "remotion";
import type { Variant } from "./variants";

const BINS = 1024;

export type AngularMap = {
  /** Uniform value in [0,1) -> angle in radians. */
  angleAt: (u: number) => number;
};

const cache = new Map<string, AngularMap>();

const build = (variant: Variant): AngularMap => {
  const { lumpiness } = variant.streaks;

  // Three harmonics with seeded frequencies and phases. Low frequencies make
  // broad dense fans, higher ones break them up.
  const harmonics = [0, 1, 2, 3].map((i) => ({
    k: 2 + Math.floor(random(`${variant.name}-harm-k-${i}`) * 4) + i * 3,
    phase: random(`${variant.name}-harm-phase-${i}`) * Math.PI * 2,
    amp: (1.05 - i * 0.24) * lumpiness,
  }));

  const density = new Float64Array(BINS);
  let total = 0;
  for (let i = 0; i < BINS; i++) {
    const theta = (i / BINS) * Math.PI * 2;
    let d = 1;
    for (const h of harmonics) {
      d += h.amp * Math.sin(h.k * theta + h.phase);
    }
    // Angles pointing below the horizon are wasted where the floor clips the
    // field, so bias against straight down. Canvas y grows downward, so
    // sin(theta) > 0 is the downward half.
    const down = Math.max(0, Math.sin(theta));
    d *= 1 - variant.streaks.upwardBias * Math.pow(down, 0.75);
    // Never fully empty: a bare sector reads as a missing wedge, not as sparse.
    d = Math.max(0.06, d);
    density[i] = d;
    total += d;
  }

  const cdf = new Float64Array(BINS + 1);
  let acc = 0;
  for (let i = 0; i < BINS; i++) {
    acc += density[i] / total;
    cdf[i + 1] = acc;
  }
  cdf[BINS] = 1;

  const angleAt = (u: number) => {
    const target = u - Math.floor(u);
    // Binary search the CDF, then interpolate inside the bin.
    let lo = 0;
    let hi = BINS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid + 1] < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    const span = cdf[lo + 1] - cdf[lo] || 1;
    const frac = (target - cdf[lo]) / span;
    return ((lo + frac) / BINS) * Math.PI * 2;
  };

  return { angleAt };
};

export const angularMap = (variant: Variant): AngularMap => {
  const hit = cache.get(variant.name);
  if (hit) {
    return hit;
  }
  const built = build(variant);
  cache.set(variant.name, built);
  return built;
};
