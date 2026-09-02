/**
 * Deterministic random helpers for frame-pure Remotion compositions.
 *
 * Every value here is a pure function of a stable string seed, so a set
 * generated in `useMemo` is byte-identical on every worker and every
 * re-render. Remotion's `random()` provides the string->number hashing;
 * a mulberry32 stream is seeded from it so that the hundreds of thousands
 * of draws a rejection sampler needs cost one multiply each instead of a
 * string hash each.
 *
 * Never use Math.random()/Date.now() in a composition: Remotion renders
 * frames out of order across workers and any non-pure value will boil.
 *
 * @example
 * const rng = makeRng("brain:particles");
 * const angle = rng() * Math.PI * 2;
 * const size = range(rng, 3, 9);
 */
import { random } from "remotion";

export type Rng = () => number;

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
const mulberry32 = (seed: number): Rng => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Builds an independent stream of uniform [0,1) values from a string seed.
 * Two calls with the same seed always produce the same sequence.
 */
export const makeRng = (seed: string): Rng =>
  mulberry32(Math.floor(random(seed) * 0xffffffff));

/** One stable value in [0,1) for a named thing — no stream needed. */
export const seedValue = (seed: string): number => random(seed);

/** Next value mapped into [min, max). */
export const range = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

/** Next value mapped into [min, max] and rounded. */
export const rangeInt = (rng: Rng, min: number, max: number): number =>
  Math.floor(min + rng() * (max - min + 1));

/** Uniform choice from a non-empty list. */
export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/**
 * Approximately normal sample in [-1, 1] (mean 0), from the average of
 * three uniforms. Useful wherever values should cluster toward the middle
 * of a range rather than spread flat across it.
 */
export const gaussianish = (rng: Rng): number =>
  ((rng() + rng() + rng()) / 3 - 0.5) * 2;

/**
 * Next value biased toward `min` (bias > 1) or toward `max` (bias < 1).
 * bias === 1 is plain uniform.
 */
export const biasedRange = (
  rng: Rng,
  min: number,
  max: number,
  bias: number,
): number => min + Math.pow(rng(), bias) * (max - min);
