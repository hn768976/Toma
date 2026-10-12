// Deterministic randomness. Nothing on screen may come from Math.random():
// every value is either baked at module load from a seeded mulberry32, or a
// pure hash of (id, frame bucket).

export const LOOP = 600; // 20s at 30fps — every composition loops on this

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

/** 32-bit integer hash of up to three ints. */
export const hash3 = (a: number, b = 0, c = 0): number => {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(c | 0, 0xc2b2ae3d);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
};

/** Hash to [0,1). */
export const hashF = (a: number, b = 0, c = 0) => hash3(a, b, c) / 4294967296;

/** Frame wrapped into the loop. */
export const loopFrame = (frame: number) => ((frame % LOOP) + LOOP) % LOOP;

/** Divisors of 600 usable as hold lengths. */
export const HOLDS_8_40 = [8, 10, 12, 15, 20, 24, 25, 30, 40];

/**
 * Bucket index for a value that re-rolls every `hold` frames (hold divides 600),
 * phase-shifted by `offset` (0 ≤ offset < hold). Periodic in 600.
 */
export const holdBucket = (f: number, hold: number, offset = 0) =>
  Math.floor((loopFrame(f) + offset) / hold) % (LOOP / hold);

/** Phase in [0,1) for something that completes `cycles` whole cycles per loop. */
export const cyc = (f: number, cycles: number, phase = 0) =>
  (((loopFrame(f) * cycles) / LOOP + phase) % 1 + 1) % 1;

export const TAU = Math.PI * 2;

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Random digit string from a hash. */
export const digits = (n: number, a: number, b = 0, c = 0) => {
  let s = "";
  for (let i = 0; i < n; i++) s += String(hash3(a, b * 31 + i, c) % 10);
  return s;
};
