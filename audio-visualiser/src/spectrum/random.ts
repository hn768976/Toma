/**
 * Deterministic helpers. Nothing in this project may call Math.random() at
 * render time: Remotion renders frames out of order across threads, so every
 * value has to be reproducible from its inputs alone.
 */

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp = (v: number, min = 0, max = 1): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smooth 0..1 ramp, zero-derivative at both ends. */
export const smoothstep = (t: number): number => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
