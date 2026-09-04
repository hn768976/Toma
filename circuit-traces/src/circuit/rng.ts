/**
 * Deterministic PRNG. Everything in this project — the trace network, the
 * component layout, the pulse schedule, the grain tiles — is derived from a
 * seed at module scope, never from `Math.random()` at render time. Remotion
 * renders frames out of order across threads, so a frame must be a pure
 * function of its frame number.
 */
export type Rng = () => number;

export const makeRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const range = (rng: Rng, lo: number, hi: number): number =>
  lo + rng() * (hi - lo);

export const intRange = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))];

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
