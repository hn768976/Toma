// Deterministic hash-based noise so every frame renders identically on every machine.

export const hash1 = (n: number): number => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

// Smooth 1D value noise in [-1, 1].
export const noise1 = (x: number, seed = 0): number => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1(i + seed * 101.3);
  const b = hash1(i + 1 + seed * 101.3);
  return (a + (b - a) * u) * 2 - 1;
};

export const fbm1 = (x: number, seed = 0, octaves = 3): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise1(x * freq, seed + o * 7.7) * amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
};

export const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
