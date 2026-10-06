/**
 * Deterministic randomness.
 *
 * - `mulberry32` generators are created from fixed module-level seeds, so every
 *   build of a scene (in any render tab, in any order) produces identical data.
 * - Per-frame variation (blinks, flicker, ticking numbers) uses the stateless
 *   `hash*` functions of (index, frame) — never Math.random(), never a clock.
 */
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

/** Module-level seeds — one per look, so looks never share a stream. */
export const SEEDS = {
  payment: 0x1a2b3c4d,
  battery: 0x5e6f7081,
  marketGlobe: 0x92a3b4c5,
  dollarGlobe: 0xd6e7f809,
  mapTicker: 0x1b2c3d4e,
  geo: 0x0badf00d,
} as const;

export type Rng = () => number;

/** Stateless integer hash → [0,1). */
export const hash = (...n: number[]) => {
  let h = 0x811c9dc5;
  for (const v of n) {
    h = Math.imul(h ^ (Math.floor(v) | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
