// Deterministic pseudo-randomness.
//
// Every per-particle and per-spike value in this project is drawn from here at
// build time (module scope), never during a render. Remotion renders frames out
// of order across threads, so anything sampled inside the render path would
// disagree between frames.

export type Rng = () => number;

/** mulberry32 — small, fast, and identical across runs for a given seed. */
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

/** Turns a look id into a stable numeric seed, so ids order-independently. */
export const hashSeed = (text: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const range = (rng: Rng, min: number, max: number): number =>
  min + rng() * (max - min);

export const intRange = (rng: Rng, min: number, max: number): number =>
  Math.floor(min + rng() * (max - min + 1));

/** Picks one of the supplied values. */
export const pick = <T,>(rng: Rng, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

/** Signed jitter in [-amount, +amount]. */
export const jitter = (rng: Rng, amount: number): number =>
  (rng() * 2 - 1) * amount;
