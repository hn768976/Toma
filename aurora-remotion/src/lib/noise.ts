/**
 * Value noise, seeded by integer hashing rather than a permutation table so
 * that any (x, y, z, seed) can be evaluated statelessly.
 *
 * Looping: time is fed in as a *circle* — y = R*cos(2*pi*t), z = R*sin(2*pi*t).
 * After one full loop the sample point returns to exactly where it started, so
 * frame 0 and frame `durationInFrames` are identical. R sets the speed.
 */

export const TAU = Math.PI * 2;

const hash3 = (xi: number, yi: number, zi: number, seed: number) => {
  let h = Math.imul(xi, 0x27d4eb2d) ^ Math.imul(yi, 0x165667b1);
  h = (h ^ Math.imul(zi, 0x9e3779b1)) >>> 0;
  h = (h ^ Math.imul(seed, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise in [0, 1). */
export const noise3 = (x: number, y: number, z: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);

  const c000 = hash3(xi, yi, zi, seed);
  const c100 = hash3(xi + 1, yi, zi, seed);
  const c010 = hash3(xi, yi + 1, zi, seed);
  const c110 = hash3(xi + 1, yi + 1, zi, seed);
  const c001 = hash3(xi, yi, zi + 1, seed);
  const c101 = hash3(xi + 1, yi, zi + 1, seed);
  const c011 = hash3(xi, yi + 1, zi + 1, seed);
  const c111 = hash3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;

  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;

  return y0 + (y1 - y0) * w;
};

/** Fractal sum of `octaves` value-noise layers, returned in [0, 1). */
export const fbm3 = (
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves = 4,
  lacunarity = 2.03,
  gain = 0.5,
) => {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 1013);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
};

/** fbm3 remapped to [-1, 1]. */
export const sfbm3 = (
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves = 4,
) => fbm3(x, y, z, seed, octaves) * 2 - 1;

/** Cheap deterministic hash of one integer, in [0, 1). */
export const hash01 = (i: number, seed: number) => {
  let h = Math.imul(i ^ seed, 0x27d4eb2d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A travelling wave train. `n` must be an integer: over t = 0 -> 1 the phase
 * advances by exactly `n` cycles, so the pattern loops seamlessly while still
 * appearing to drift along the curtain.
 */
export type Wave = {a: number; f: number; n: number; ph: number};

export const waveSum = (waves: readonly Wave[], x: number, t: number) => {
  let v = 0;
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i];
    v += w.a * Math.sin(TAU * (w.f * x + w.n * t + w.ph));
  }
  return v;
};
