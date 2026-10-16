// Deterministic randomness. Nothing on screen may use Math.random():
// layouts come from a seeded mulberry32 stream created at module level,
// per-frame flicker comes from integer hashes of the frame number.

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

/** Integer hash -> [0,1). Stateless, so safe for out-of-order frame rendering. */
export const hash1 = (...n: number[]) => {
  let h = 0x811c9dc5;
  for (const v of n) {
    h = Math.imul(h ^ (Math.floor(v) | 0), 0x01000193);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) / 4294967296;
};

export const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]) =>
  arr[Math.floor(rng() * arr.length) % arr.length];

export const TAU = Math.PI * 2;

/** Phase in [0,1) of a loop. frame is wrapped first so frame N and N+len are identical. */
export const loopPhase = (frame: number, len: number) =>
  (((frame % len) + len) % len) / len;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutBack = (t: number) => {
  const x = clamp01(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
