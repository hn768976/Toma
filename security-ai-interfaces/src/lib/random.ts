// Seeded randomness. Every generator is created at MODULE level and all
// tables are built once, before any frame renders. Nothing here is ever
// called with Math.random(), Date.now() or any clock.

import { TAU, wave, lf } from "./loop";

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

export const rRange = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const rInt = (r: Rng, a: number, b: number) => Math.floor(rRange(r, a, b + 1));
export const rPick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];

/** Stateless integer hash -> [0,1). Used for values that change in steps. */
export const hash01 = (...n: number[]) => {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h ^= Math.floor(v) | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

const ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
const DIGITS = "0123456789";

/**
 * A string whose characters re-roll every `every` frames (every must divide 600).
 * `pattern`: 'A' alnum, '9' digit, anything else literal.
 */
export const flicker = (pattern: string, seed: number, frame: number, every: number) => {
  const step = Math.floor(lf(frame) / every);
  let s = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    // stagger: each slot changes on its own sub-phase so not all flip together
    const slotStep = Math.floor((lf(frame) + Math.floor(hash01(seed, i) * every)) / every) % (600 / every);
    const k = c === "A" || c === "9" ? slotStep : step;
    if (c === "A") s += ALNUM[Math.floor(hash01(seed, i, k) * ALNUM.length)];
    else if (c === "9") s += DIGITS[Math.floor(hash01(seed, i, k) * DIGITS.length)];
    else s += c;
  }
  return s;
};

/**
 * Smooth periodic drift in roughly [-1, 1]: a sum of sines with whole-number
 * cycles per loop and seeded phases. Built once at module level.
 */
export const makeDrift = (seed: number, harmonics: number[] = [1, 2, 3, 5]) => {
  const r = mulberry32(seed);
  const parts = harmonics.map((h, i) => ({ h, p: r(), a: 1 / (1 + i * 0.6) }));
  const norm = parts.reduce((s, p) => s + p.a, 0);
  return (f: number) => parts.reduce((s, p) => s + p.a * wave(f, p.h, p.p), 0) / norm;
};

/**
 * Periodic data series of length n: a function sampled around a circle, so
 * index n wraps smoothly to 0. Used for charts that scroll.
 */
export const makeSeries = (seed: number, n: number, harmonics = [1, 2, 3, 5, 8, 13]) => {
  const r = mulberry32(seed);
  const parts = harmonics.map((h, i) => ({ h, p: r() * TAU, a: (1 / (1 + i * 0.7)) * (0.6 + 0.8 * r()) }));
  const raw = Array.from({ length: n }, (_, i) =>
    parts.reduce((s, p) => s + p.a * Math.sin((TAU * p.h * i) / n + p.p), 0),
  );
  const lo = Math.min(...raw);
  const hi = Math.max(...raw);
  return raw.map((v) => (v - lo) / (hi - lo));
};
