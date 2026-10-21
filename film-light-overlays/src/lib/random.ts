// Deterministic randomness. Nothing in this project calls Math.random().

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = ReturnType<typeof mulberry32>;

// Integer hash -> 32-bit seed (for per-frame-pair generators).
export const hashInt = (x: number, salt = 0) => {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

// Uniform [0,1) from an integer key.
export const hash01 = (x: number, salt = 0) => hashInt(x, salt) / 4294967296;

// RNG for a given frame pair: floor(frame / 2) mod 300 (repeats every 600 frames).
export const pairKey = (frame: number) => Math.floor(frame / 2) % 300;
export const pairRng = (frame: number, salt: number) =>
  mulberry32(hashInt(pairKey(frame), salt));

export const range = (r: Rng, lo: number, hi: number) => lo + (hi - lo) * r();
export const pick = <T,>(r: Rng, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];

export const TAU = Math.PI * 2;
export const LOOP = 600;

// Smooth periodic noise: a sum of sinusoids with whole-number frequencies,
// so it repeats exactly when `phase` advances by 1. Output roughly in [-1, 1].
export type PeriodicNoise = (phase: number) => number;
export const periodicNoise = (
  rng: Rng,
  minFreq = 1,
  maxFreq = 4,
): PeriodicNoise => {
  const terms: { f: number; a: number; p: number }[] = [];
  let norm = 0;
  for (let f = minFreq; f <= maxFreq; f++) {
    const a = (0.5 + rng()) / f;
    terms.push({ f, a, p: rng() * TAU });
    norm += a * a;
  }
  const k = 1 / Math.sqrt(norm * 0.5) / 1.6;
  return (phase: number) => {
    let s = 0;
    for (const t of terms) s += t.a * Math.sin(TAU * t.f * phase + t.p);
    return Math.max(-1, Math.min(1, s * k));
  };
};

export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
