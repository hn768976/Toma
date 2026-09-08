/**
 * Deterministic randomness. Everything generated for the composition — chart
 * series, dot brightness clustering, label content, arc endpoints — comes from
 * here so that every render of a given frame is identical, which matters
 * because Remotion renders frames out of order across threads.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, well distributed for visual work. */
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const randRange = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

export const randInt = (rng: Rng, min: number, maxInclusive: number): number =>
  min + Math.floor(rng() * (maxInclusive - min + 1));

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Seeded 2D value noise on a 256x256 lattice. Used for the low-frequency
 * "activity concentration" field that drives dot density and brightness.
 */
export const makeNoise2D = (seed: number): ((x: number, y: number) => number) => {
  const size = 256;
  const rng = mulberry32(seed);
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng();

  const at = (ix: number, iy: number): number =>
    lattice[(iy & (size - 1)) * size + (ix & (size - 1))];

  return (x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smootherstep(x - x0);
    const fy = smootherstep(y - y0);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bot = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bot - top) * fy;
  };
};

/** Two octaves of the above, normalised back to roughly 0..1. */
export const makeFbm2D = (seed: number): ((x: number, y: number) => number) => {
  const a = makeNoise2D(seed);
  const b = makeNoise2D(seed + 7919);
  return (x: number, y: number) => a(x, y) * 0.68 + b(x * 2.7, y * 2.7) * 0.32;
};
