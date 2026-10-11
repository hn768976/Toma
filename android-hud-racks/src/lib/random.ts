// Seeded randomness. Every on-screen value is a pure function of the frame
// number and a seed, so Remotion can render frames out of order on several
// threads and still get identical pixels. Never use Math.random().

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

// Stateless integer hash -> [0, 1). Used where a value depends on an index
// (a hold slot, an LED, a character) rather than on a sequence.
export const hash01 = (seed: number, i: number, j = 0): number => {
  let h = (seed * 374761393 + i * 668265263 + j * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};

export const TAU = Math.PI * 2;

// A random walk that closes on itself: N seeded increments with their mean
// removed, so after N steps it is back where it started. Sampled with
// smooth interpolation between steps. `loop` must be the composition loop.
export const makeLoopWalk = (seed: number, steps: number) => {
  const rnd = mulberry32(seed);
  const inc: number[] = [];
  for (let i = 0; i < steps; i++) inc.push(rnd() * 2 - 1);
  const mean = inc.reduce((a, b) => a + b, 0) / steps;
  const pts: number[] = [0];
  for (let i = 0; i < steps; i++) pts.push(pts[i] + inc[i] - mean);
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  const span = Math.max(1e-6, hi - lo);
  const norm = pts.map((p) => (p - lo) / span); // 0..1, norm[0] === norm[steps]
  return (frame: number, loop: number) => {
    const t = (((frame % loop) + loop) % loop) / loop;
    const x = t * steps;
    const i = Math.floor(x);
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return norm[i] + (norm[i + 1] - norm[i]) * s;
  };
};

// Hold-and-step: the value changes every `hold` frames. `hold` must divide
// the composition length so the sequence wraps cleanly.
export const holdIndex = (frame: number, hold: number, loop: number) =>
  Math.floor((((frame % loop) + loop) % loop) / hold);

export const holdValue = (
  seed: number,
  frame: number,
  hold: number,
  loop: number,
) => hash01(seed, holdIndex(frame, hold, loop));

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const randomCaps = (seed: number, i: number, n: number) => {
  let s = "";
  for (let k = 0; k < n; k++) s += LETTERS[Math.floor(hash01(seed, i, k) * 26)];
  return s;
};
export const randomDigits = (seed: number, i: number, n: number) => {
  let s = "";
  for (let k = 0; k < n; k++) s += Math.floor(hash01(seed, i, k + 101) * 10);
  return s;
};
