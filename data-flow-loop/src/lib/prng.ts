/**
 * Deterministic PRNG. Every value in the scene comes from here, seeded once,
 * so a render at frame N is byte-identical on every machine and every run.
 * No Math.random(), no Date.now() anywhere in the render path.
 */
export type Rng = {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (min: number, maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  /** Roughly-gaussian sample in [-1,1] (sum of 3 uniforms). */
  gauss: () => number;
  bool: (probability: number) => boolean;
};

export const mulberry32 = (seed: number): Rng => {
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
    range: (min, max) => min + (max - min) * next(),
    int: (min, maxExclusive) =>
      min + Math.floor(next() * (maxExclusive - min)),
    pick: (items) => items[Math.floor(next() * items.length) % items.length],
    gauss: () => (next() + next() + next() - 1.5) / 1.5,
    bool: (probability) => next() < probability,
  };
};

/** Wrap `v` into [-period/2, period/2). Used for tile-periodic distances. */
export const wrapCentered = (v: number, period: number) => {
  const half = period / 2;
  return ((((v + half) % period) + period) % period) - half;
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** sRGB hex -> linear-ish RGB triple in 0..1. */
export const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};
