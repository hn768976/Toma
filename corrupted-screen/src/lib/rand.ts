/**
 * Deterministic value noise.
 *
 * Every random-looking number in this project comes from here, keyed on
 * (elementId, frame % durationInFrames). Nothing uses Math.random(), so a
 * render is bit-identical across threads and the 600 frame pattern repeats
 * exactly at the loop point.
 */

/** Turn a human readable id into a stable integer seed (FNV-1a). */
export const seedOf = (id: string): number => {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/** Hash up to four integers into [0, 1). */
export const hash = (a: number, b = 0, c = 0, d = 0): number => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35);
  h ^= Math.imul((c | 0) + 0x165667b1, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 13), 0x85ebca6b);
  h ^= Math.imul((d | 0) + 0x2545f491, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x2545f491);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

export const rand = (min: number, max: number, a: number, b = 0, c = 0, d = 0): number =>
  min + (max - min) * hash(a, b, c, d);

/** Biased towards `min` for exponent > 1, towards `max` for exponent < 1. */
export const randPow = (
  min: number,
  max: number,
  exponent: number,
  a: number,
  b = 0,
  c = 0,
  d = 0,
): number => min + (max - min) * Math.pow(hash(a, b, c, d), exponent);

export const randInt = (min: number, maxExclusive: number, a: number, b = 0, c = 0, d = 0): number =>
  min + Math.floor(hash(a, b, c, d) * (maxExclusive - min));

export const chance = (probability: number, a: number, b = 0, c = 0, d = 0): boolean =>
  hash(a, b, c, d) < probability;

/** Symmetric noise in [-1, 1). */
export const signed = (a: number, b = 0, c = 0, d = 0): number => hash(a, b, c, d) * 2 - 1;

/**
 * A tiny xorshift, used only where thousands of values are needed for a single
 * frame (the grain tile). Seeded from `hash`, so it stays deterministic.
 */
export const makeRng = (seed: number): (() => number) => {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
};
