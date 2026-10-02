// Deterministic pseudo-random numbers. Nothing in this project calls
// Math.random(): every random-looking value comes from a seeded mulberry32.

export type Rng = () => number;

export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// FNV-1a, used to derive independent sub-seeds ("ETF/wood", "ETF/chart"...).
export const hashString = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const seeded = (...parts: (string | number)[]): Rng =>
  mulberry32(hashString(parts.join("/")));

export const range = (rng: Rng, lo: number, hi: number) => lo + (hi - lo) * rng();
export const pick = <T,>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length) % arr.length];
export const signed = (rng: Rng) => (rng() < 0.5 ? -1 : 1);

// Gaussian-ish (Irwin-Hall, n=4), mean 0, sd ~1.
export const gauss = (rng: Rng) => (rng() + rng() + rng() + rng() - 2) * 1.7320508;

// Seeded 1D/2D value noise with smooth interpolation.
export const makeNoise2D = (rng: Rng) => {
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  const p = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < N * 2; i++) perm[i] = p[i & 255];
  for (let i = 0; i < N; i++) vals[i] = rng();
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const v00 = vals[perm[X + perm[Y]]];
    const v10 = vals[perm[X + 1 + perm[Y]]];
    const v01 = vals[perm[X + perm[Y + 1]]];
    const v11 = vals[perm[X + 1 + perm[Y + 1]]];
    const u = fade(xf);
    const v = fade(yf);
    return (v00 * (1 - u) + v10 * u) * (1 - v) + (v01 * (1 - u) + v11 * u) * v;
  };
};

export const fbm2 = (
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
) => {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return sum / (1 - Math.pow(0.5, octaves));
};
