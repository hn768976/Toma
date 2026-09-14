/**
 * Deterministic pseudo-randomness.
 *
 * Every frame of a Remotion render re-mounts the component tree, so any value
 * that should stay put between frames has to be derived from a seed rather
 * than Math.random().
 */

/** Hash a string seed into a 32-bit integer. */
const hashSeed = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** mulberry32 - small, fast, good enough for decorative noise. */
export const makeRandom = (seed: string): (() => number) => {
  let a = hashSeed(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A single stable number in [min, max) for a given seed. */
export const randomBetween = (seed: string, min: number, max: number): number =>
  min + makeRandom(seed)() * (max - min);

/** `count` stable numbers in [min, max). */
export const randomSeries = (
  seed: string,
  count: number,
  min = 0,
  max = 1,
): number[] => {
  const random = makeRandom(seed);
  return Array.from({ length: count }, () => min + random() * (max - min));
};

/**
 * A smooth 1-D value-noise walk sampled at `t`, used for readouts and needles
 * that should wander rather than jump.
 */
export const noise1d = (seed: string, t: number): number => {
  const i = Math.floor(t);
  const f = t - i;
  const a = randomBetween(`${seed}:${i}`, 0, 1);
  const b = randomBetween(`${seed}:${i + 1}`, 0, 1);
  const smooth = f * f * (3 - 2 * f);
  return a + (b - a) * smooth;
};
