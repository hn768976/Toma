/** Seeded PRNG. Every random layout in the project comes from one of these. */
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

/** Stateless integer hash -> [0, 1). Used for per-frame flicker. */
export const hash01 = (...values: number[]) => {
  let h = 0x811c9dc5;
  for (const v of values) {
    h = Math.imul(h ^ (Math.floor(v) | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Smooth periodic 1D noise: sum of seeded sines, whole cycles per period. */
export const loopNoise = (rand: () => number, octaves = 3) => {
  const terms = Array.from({ length: octaves }, (_, i) => ({
    k: 1 + Math.floor(rand() * (2 + i * 2)),
    ph: rand() * TAU,
    a: 1 / (i + 1),
  }));
  const norm = terms.reduce((s, t) => s + t.a, 0);
  /** phase in [0,1) over one loop -> [-1,1] */
  return (phase: number) =>
    terms.reduce((s, t) => s + t.a * Math.sin(TAU * t.k * phase + t.ph), 0) / norm;
};
