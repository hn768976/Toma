/** Small seeded PRNG (mulberry32) so every render is bit-for-bit repeatable. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * next()),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof makeRng>;

/** Cheap deterministic value noise in 2D (+ time), range roughly -1..1. */
export function wobble(x: number, z: number, t: number) {
  return (
    Math.sin(x * 0.9 + t * 1.1) * 0.5 +
    Math.sin(z * 1.3 - t * 0.8 + x * 0.35) * 0.35 +
    Math.sin((x + z) * 0.55 + t * 0.6 + 1.7) * 0.4
  );
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Smoothstep between a and b. */
export const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
