import { rndInt, rndRange } from "./random";

/**
 * A seeded, static sum-of-sines profile, for any boundary that must not be a
 * straight line: a ground ridge, a snow line, a hill silhouette, the top of a
 * liquid. A straight horizontal boundary reads as a gradient or a graphic
 * device; an irregular one reads as a thing.
 *
 * Deterministic and palette-agnostic. Build it once (useMemo) and evaluate it
 * per point.
 */
export type EdgeProfile = { amp: number; period: number; phase: number }[];

export const buildEdgeProfile = (seed: string, layers = 4): EdgeProfile =>
  new Array(layers).fill(0).map((_, i) => ({
    amp: rndRange(`${seed}-amp-${i}`, 0.35, 1) / (i + 1),
    period: rndInt(`${seed}-period-${i}`, 1, 3) + i * 2,
    phase: rndRange(`${seed}-phase-${i}`, 0, Math.PI * 2),
  }));

/**
 * Evaluates a profile at horizontal position `u`, normalised to -1..1.
 *
 * `u` is usually 0..1 across the shape, but larger values are fine and are how
 * you get a second, finer profile out of the same seed: evaluate it again at
 * `u * 3.1` and add it at a smaller amplitude.
 */
export const edgeAt = (profile: EdgeProfile, u: number) => {
  let sum = 0;
  let norm = 0;
  for (const layer of profile) {
    sum += layer.amp * Math.sin(u * Math.PI * 2 * layer.period + layer.phase);
    norm += layer.amp;
  }
  return norm === 0 ? 0 : sum / norm;
};
