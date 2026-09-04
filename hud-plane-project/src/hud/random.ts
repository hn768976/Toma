// Deterministic helpers. Nothing here touches Math.random() and nothing is
// stateful across frames — Remotion renders frames out of order across
// threads, so every value must be a pure function of its inputs.

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

/** FNV-1a over a string id. */
export const hashString = (str: string): number => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

/**
 * Seeded hash of (elementId, n) in [0, 1). Callers pass
 * `frame % durationInFrames` as n, so the value repeats exactly at the loop
 * point.
 */
export const hash01 = (id: string, n: number): number => {
  let h = (hashString(id) ^ Math.imul(n >>> 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Fixed per-element phase offset in [0, 1). */
export const seededPhase = (id: string): number =>
  hashString(id) / 4294967296;

/**
 * A wave in [0, 1] that closes perfectly over the loop.
 * `cycles` must be an integer or the loop point will pop.
 */
export const loopWave = (t: number, cycles: number, phase: number): number =>
  0.5 + 0.5 * Math.sin(Math.PI * 2 * (cycles * t + phase));

/** Wraps x into [0, 1). */
export const frac = (x: number): number => x - Math.floor(x);

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const mix = (a: number, b: number, k: number): number => a + (b - a) * k;
