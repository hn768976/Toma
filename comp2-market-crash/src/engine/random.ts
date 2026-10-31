// Deterministic pseudo-random helpers so every render produces identical frames.

export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, maxExclusive: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  gauss: () => number;
  chance: (p: number) => boolean;
  unitVec: () => [number, number, number];
};

export const createRng = (seed: number): Rng => {
  let s = seed >>> 0 || 1;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    const u = Math.max(next(), 1e-9);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gauss,
    chance: (p) => next() < p,
    unitVec: () => {
      const z = next() * 2 - 1;
      const a = next() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      return [r * Math.cos(a), r * Math.sin(a), z];
    },
  };
};

export const clamp = (v: number, a: number, b: number) =>
  Math.min(b, Math.max(a, v));

export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
