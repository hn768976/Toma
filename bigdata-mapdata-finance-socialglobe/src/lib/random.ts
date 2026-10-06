// Deterministic randomness.
//
// Remotion renders frames out of order on several tabs, so nothing on screen
// may depend on call order at render time. Two tools are allowed:
//   - `mulberry32` streams, seeded and consumed at MODULE LEVEL / build time
//     (scene layout: identical in every tab because the build order is fixed);
//   - `hash*`, pure functions of integers, for anything that changes per frame.

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

export const range = (r: Rng, a: number, b: number) => a + (b - a) * r();
export const irange = (r: Rng, a: number, b: number) =>
  Math.floor(a + (b - a + 1) * r());
export const pick = <T,>(r: Rng, arr: readonly T[]): T =>
  arr[Math.floor(r() * arr.length) % arr.length];

// Integer hash (lowbias32). Pure: same inputs, same output, in every tab.
const mix = (x: number) => {
  x = x >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
};

export const hash1 = (a: number) => mix(a | 0) / 4294967296;
export const hash2 = (a: number, b: number) =>
  mix(mix(a | 0) ^ Math.imul(b | 0, 0x9e3779b1)) / 4294967296;
export const hash3 = (a: number, b: number, c: number) =>
  mix(mix(mix(a | 0) ^ Math.imul(b | 0, 0x9e3779b1)) ^ Math.imul(c | 0, 0x85ebca77)) /
  4294967296;

export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const remap = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/**
 * "Beat" animation: a value that eases between random targets, one target per
 * `beat` frames. Targets are hash(seed, index mod count), so with
 * count = loop / beat the sequence repeats exactly every `loop` frames.
 * `ease` is the fraction of each beat spent moving (rest = hold).
 */
export const beatValue = (
  frame: number,
  seed: number,
  beat: number,
  loop: number,
  ease = 0.45,
) => {
  const count = Math.max(1, Math.round(loop / beat));
  const f = ((frame % loop) + loop) % loop;
  const i = Math.floor(f / beat);
  const t = (f - i * beat) / beat;
  const a = hash2(seed, i % count);
  const b = hash2(seed, (i + 1) % count);
  return lerp(a, b, smooth(clamp01(t / ease)));
};

/** Integer step value: changes every `rate` frames, repeats every `loop`. */
export const stepIndex = (frame: number, rate: number, loop: number) => {
  const count = Math.max(1, Math.round(loop / rate));
  const f = ((frame % loop) + loop) % loop;
  return Math.floor(f / rate) % count;
};

/** Closed-cycle oscillation with an integer number of periods per loop. */
export const cyc = (frame: number, loop: number, k = 1, phase = 0) =>
  Math.sin(((2 * Math.PI * k * frame) / loop) + phase);

/** Digit string with stable shape ("#### ## ###") filled from a hash. */
export const digitString = (pattern: string, seed: number, step: number) => {
  let out = "";
  let n = 0;
  for (const ch of pattern) {
    if (ch === "#") {
      out += String(Math.floor(hash3(seed, step, n++) * 10));
    } else {
      out += ch;
    }
  }
  return out;
};

/**
 * Rolling digits: each digit position flips at its own pace. Positions in
 * `pattern` marked "#" roll; others stay. The result repeats every `loop`.
 */
export const rollingDigits = (
  pattern: string,
  seed: number,
  frame: number,
  loop: number,
  rate: number,
) => {
  let out = "";
  let n = 0;
  for (const ch of pattern) {
    if (ch === "#") {
      // Each position gets a per-position rate in {rate, 2rate, 3rate}
      // (all must divide `loop` for a clean repeat).
      const mult = 1 + Math.floor(hash2(seed, n * 7 + 3) * 3);
      const r = rate * mult;
      const s = stepIndex(frame + Math.floor(hash2(seed, n) * r), r, loop);
      out += String(Math.floor(hash3(seed, n, s) * 10));
      n++;
    } else {
      out += ch;
    }
  }
  return out;
};
