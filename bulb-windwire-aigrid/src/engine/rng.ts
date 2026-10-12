// Seeded randomness. Every generator is created at module level from a fixed
// seed and consumed in a fixed order while building static layouts, so the
// layouts are identical in every render thread. Nothing here is called with
// the frame number as state; per-frame motion is a pure function of the frame.

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = ReturnType<typeof mulberry32>;

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const pick = <T,>(r: Rng, arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length];
/** Approximately normal (sum of 4 uniforms), mean 0, sd ~1. */
export const gauss = (r: Rng) => (r() + r() + r() + r() - 2) * 1.732;

/** Stateless integer hash -> [0,1). */
export const hash01 = (n: number) => {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Smooth 0..1 ease for story timing. */
export const ease = (x: number) => {
  const t = clamp(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
