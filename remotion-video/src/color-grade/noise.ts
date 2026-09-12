// Deterministic noise. Remotion renders frames out of order across
// workers, so every value that varies over time must be a pure function
// of (frame, ...ids) — never Math.random() or a mutable accumulator, or
// the scopes would flicker and tear between frames.

export const mulberry32 = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stable hash -> [0, 1). Cheap enough to call per sample per frame. */
export const hash = (a: number, b = 0, c = 0) => {
  let t = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
};

/** Smoothstep-interpolated 1D value noise. Continuous, unlike hash(). */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
};

/** Fractal value noise; more octaves = more fine detail. */
export const fbm = (x: number, seed = 0, octaves = 3) => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
};

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Classic ease-in-out, for hand-authored cursor keyframes. */
export const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Slower start, long glide out — reads like a hand settling on a target. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
