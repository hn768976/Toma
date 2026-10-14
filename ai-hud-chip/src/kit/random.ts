// Deterministic randomness. Nothing on screen may depend on Math.random():
// everything is seeded at module level or hashed from (slot, frame bucket).

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

/** Integer hash of two ints → [0, 1). Same on every thread and every run. */
export const hash2 = (a: number, b: number): number => {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();

/**
 * A value that holds for a seeded number of frames, then changes.
 * Hold lengths divide `period` exactly (so loops close) and the value is a
 * pure function of (slot, frame).
 */
export const heldIndex = (slot: number, frame: number, holds: readonly number[], period: number) => {
  const hold = holds[Math.floor(hash2(slot, 7) * holds.length) % holds.length];
  const f = ((frame % period) + period) % period;
  const offset = Math.floor(hash2(slot, 11) * hold);
  return Math.floor((f + offset) / hold) % Math.ceil(period / hold);
};

const DIGITS = "0123456789";
/** A string of digits that ticks on a seeded hold schedule. */
export const tickDigits = (slot: number, frame: number, len: number, holds: readonly number[], period: number) => {
  const idx = heldIndex(slot, frame, holds, period);
  let s = "";
  for (let i = 0; i < len; i++) s += DIGITS[Math.floor(hash2(slot * 131 + i, idx * 977 + 3) * 10)];
  return s;
};
