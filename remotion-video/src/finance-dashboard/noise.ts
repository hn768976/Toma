// Deterministic hashing / noise. Every animated value in the dashboard is
// a pure function of (element id, time) so Remotion can render frames out
// of order on parallel workers without any flicker between them.

const fmix = (h: number) => {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

// Uniform [0,1) from up to four integer inputs.
export const hashN = (a: number, b = 0, c = 0, d = 0): number => {
  let h = 0x811c9dc5;
  h = Math.imul(h ^ (a | 0), 0x01000193);
  h = Math.imul(h ^ (b | 0), 0x01000193);
  h = Math.imul(h ^ (c | 0), 0x01000193);
  h = Math.imul(h ^ (d | 0), 0x01000193);
  return fmix(h) / 4294967296;
};

// Smooth 1D value noise in [0,1).
export const vnoise = (x: number, seed: number): number => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hashN(i, seed) * (1 - u) + hashN(i + 1, seed) * u;
};

// A few octaves of value noise, still in [0,1).
export const fbm = (x: number, seed: number): number =>
  0.6 * vnoise(x, seed) +
  0.28 * vnoise(x * 2.13 + 7.1, seed + 101) +
  0.12 * vnoise(x * 4.31 + 13.7, seed + 202);

// Value that "steps" to a new random target every `period` seconds, with
// the change moment offset per element so not everything ticks together.
export const stepped = (t: number, period: number, seed: number): number => {
  const phase = hashN(seed, 77) * period;
  return hashN(Math.floor((t + phase) / period), seed, 5);
};

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

// Pseudo data labels: short uppercase tokens and numeric readouts.
const WORDS = [
  "SECTOR", "AIR", "SYS", "NODE", "CRE", "FLOW", "LOAD", "IDX", "VOL",
  "NET", "RISK", "ALPHA", "BETA", "DELTA", "OPS", "MKT", "POS", "YLD",
];

export const word = (seed: number) => WORDS[Math.floor(hashN(seed, 9) * WORDS.length)];

export const hexToken = (seed: number, len: number) => {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += "0123456789ABCDEF"[Math.floor(hashN(seed, i, 3) * 16)];
  }
  return s;
};

export const digits = (seed: number, len: number) => {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += String(Math.floor(hashN(seed, i, 4) * 10));
  }
  return s;
};
