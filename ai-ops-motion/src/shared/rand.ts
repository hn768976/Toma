/**
 * Deterministic pseudo-randomness. Every value in these films has to be a pure
 * function of the frame number, otherwise a distributed render would stitch
 * together frames that disagree with each other.
 */

/** Hash a string seed to a 32-bit integer. */
const hashSeed = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Stable [0, 1) value for a seed — the drop-in replacement for Math.random(). */
export const rand = (seed: string): number => {
  let h = hashSeed(seed);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

export const randRange = (seed: string, min: number, max: number): number =>
  min + rand(seed) * (max - min);

export const pick = <T,>(seed: string, items: readonly T[]): T =>
  items[Math.floor(rand(seed) * items.length) % items.length];

/**
 * Smooth 1-D value noise in [-1, 1]. `t` is in noise units (roughly one
 * "wobble" per unit) so callers pass frame / period.
 */
export const noise1 = (seed: string, t: number): number => {
  const i = Math.floor(t);
  const f = t - i;
  // Smoothstep the interpolant so the derivative is continuous at the knots.
  const s = f * f * (3 - 2 * f);
  const a = rand(`${seed}:${i}`) * 2 - 1;
  const b = rand(`${seed}:${i + 1}`) * 2 - 1;
  return a + (b - a) * s;
};

/** Layered noise, for signals that need both a slow drift and fine detail. */
export const fbm = (seed: string, t: number, octaves = 3): number => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(`${seed}#${o}`, t * 2 ** o) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
};

/** Noise mapped into [min, max]. */
export const wander = (
  seed: string,
  t: number,
  min: number,
  max: number,
  octaves = 3,
): number => min + ((fbm(seed, t, octaves) + 1) / 2) * (max - min);
