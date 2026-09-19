// Deterministic pseudo-randomness.
//
// Remotion renders frames out of order across parallel workers, so every
// value in this composition must be a pure function of its inputs
// (block index, frame, event id...). Math.random() or Date.now() would
// make each worker draw a different picture and the video would strobe.

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Single-shot hash: same (a, b, c) always yields the same 0..1 value.
export const hash3 = (a: number, b: number, c: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ b ^ 0xc2b2ae35, 0x27d4eb2f);
  h = Math.imul(h ^ c ^ 0x165667b1, 0x2545f491);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

export const hash2 = (a: number, b: number) => hash3(a, b, 0);

// Smooth 1-D value noise — used for drifts that should wander rather
// than jitter (bloom position, slow field brightness).
export const valueNoise1D = (x: number, seed: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f); // smoothstep
  const a = hash2(i, seed);
  const b = hash2(i + 1, seed);
  return a + (b - a) * u;
};

export const clamp = (v: number, lo = 0, hi = 1) =>
  v < lo ? lo : v > hi ? hi : v;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
