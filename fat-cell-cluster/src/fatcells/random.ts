/**
 * Deterministic pseudo-randomness.
 *
 * Everything on screen must be a pure function of `useCurrentFrame()`, so every
 * random draw in this project happens ONCE, at module-evaluation time, from a
 * seeded generator. Nothing in here may be called from a render path.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Uniform in [lo, hi). */
export const range = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);

/** Integer in [lo, hi]. */
export const rangeInt = (rng: Rng, lo: number, hi: number) =>
  Math.floor(lo + rng() * (hi - lo + 1));

/** Sum of three draws, approximately Gaussian, centred on 0, range (-1.5, 1.5). */
export const bell = (rng: Rng) => rng() + rng() + rng() - 1.5;

/** A point on the unit sphere, uniformly distributed. */
export const onSphere = (rng: Rng): [number, number, number] => {
  const z = range(rng, -1, 1);
  const t = range(rng, 0, Math.PI * 2);
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(t), r * Math.sin(t), z];
};

/** A point inside the unit ball, uniformly distributed by volume. */
export const inBall = (rng: Rng): [number, number, number] => {
  const [x, y, z] = onSphere(rng);
  const r = Math.cbrt(rng());
  return [x * r, y * r, z * r];
};

/** Fisher-Yates, in place, using the supplied generator. */
export const shuffle = <T,>(rng: Rng, items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

/** Hash a string to a 32-bit seed, so composition ids can seed their own scenes. */
export const seedFrom = (label: string): number => {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
