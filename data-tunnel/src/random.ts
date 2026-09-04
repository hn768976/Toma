// Deterministic PRNG and value noise. The whole point volume is derived
// from these, so the geometry is byte-identical on every machine and in
// every render thread.

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hash3 = (x: number, y: number, z: number, seed: number): number => {
  let h = seed ^ Math.imul(x | 0, 374761393);
  h = Math.imul(h ^ Math.imul(y | 0, 668265263), 1274126177);
  h ^= Math.imul(z | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const fade = (t: number): number => t * t * (3 - 2 * t);

// Trilinearly interpolated value noise in [0, 1]. Used as the low-frequency
// brightness field, so the tunnel has glowing regions and darker stretches
// rather than uniform-random speckle.
export const valueNoise3 = (
  x: number,
  y: number,
  z: number,
  seed = 1337,
): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = fade(x - xi);
  const ty = fade(y - yi);
  const tz = fade(z - zi);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const c = (dx: number, dy: number, dz: number) =>
    hash3(xi + dx, yi + dy, zi + dz, seed);

  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), tx);
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), tx);
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), tx);
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), tx);

  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
};

// Fractal sum of two octaves: broad glowing regions with some structure
// inside them.
export const brightnessField = (x: number, y: number, z: number): number => {
  const a = valueNoise3(x * 0.075, y * 0.075, z * 0.022, 7717);
  const b = valueNoise3(x * 0.19, y * 0.19, z * 0.06, 4241);
  return a * 0.72 + b * 0.28;
};
