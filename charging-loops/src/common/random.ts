// Deterministic randomness. Everything is seeded at module level or hashed
// from (id, frame bucket); nothing on screen depends on Math.random().

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

// Integer hash -> [0, 1). Stateless, so any frame can be computed on its own.
export const hash2 = (a: number, b: number): number => {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Cosine ease, 0..1 -> 0..1
export const cosEase = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
