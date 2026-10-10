/**
 * Seeded randomness. Everything that is "random" in this project comes from
 * here and is seeded at module level, so it is identical in every render
 * thread. There is no Math.random() anywhere.
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Integer hash of two ints -> uint32. Stateless, so safe at any frame. */
export const hash2 = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

export const range = (r: () => number, lo: number, hi: number): number =>
  lo + (hi - lo) * r();

export const pick = <T,>(r: () => number, arr: readonly T[]): T =>
  arr[Math.floor(r() * arr.length) % arr.length];

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const TAU = Math.PI * 2;
